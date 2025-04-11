"""
Leveling system for Discord bot that tracks user activity and awards XP.
Includes voice channel XP, text message XP tracking, and admin commands.
"""
import sqlite3
import time
from typing import Optional, Union, List, Dict, Any, Callable

import discord
from discord import app_commands
from discord.ext import commands, tasks

# Configuration
CONFIG = {
    "database": {"path": "leveling.db", "pool_size": 5},
    "xp": {"base_voice_xp": 1, "base_message_xp": 5, "min_voice_users": 2},
    "channels": {
        "blacklisted_voice": [1352349213614145547],
        "bonus_channels": [1242015121040080917, 1270359419862909020],
    },
    "roles": {"moderator": 1242051406580416574},
    "cache": {"ttl": 300},  # Cache time-to-live in seconds
}


class DatabaseManager:
    """Manages database connections and operations for the leveling system."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.connection_pool = []
        self._setup_database()

    def _setup_database(self):
        """Set up the database schema if it doesn't exist."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Create users table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER,
                    guild_id INTEGER,
                    xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 0,
                    last_message_time INTEGER DEFAULT 0,
                    PRIMARY KEY (user_id, guild_id)
                )
            """
            )

            # Create settings table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    guild_id INTEGER PRIMARY KEY,
                    xp_multiplier REAL DEFAULT 1.0,
                    expires_at INTEGER DEFAULT NULL
                )
            """
            )

            # Create indexes
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_users_guild ON users(guild_id)"
            )
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp)")

            conn.commit()

    def get_connection(self):
        """Get a database connection from the pool or create a new one."""
        if self.connection_pool:
            return self.connection_pool.pop()
        return sqlite3.connect(self.db_path)

    def release_connection(self, conn):
        """Return a connection to the pool."""
        if len(self.connection_pool) < CONFIG["database"]["pool_size"]:
            self.connection_pool.append(conn)
        else:
            conn.close()

    def execute(self, query: str, params: tuple = ()) -> Any:
        """Execute a query and return the result."""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.fetchall()
        finally:
            self.release_connection(conn)

    def execute_many(self, query: str, params_list: List[tuple]) -> None:
        """Execute multiple queries with different parameters."""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.executemany(query, params_list)
            conn.commit()
        finally:
            self.release_connection(conn)


class Cache:
    """Simple time-based cache for reducing database calls."""

    def __init__(self, ttl: int = 300):
        self.cache = {}
        self.ttl = ttl

    def get(self, key: str) -> Any:
        """Get a value from the cache if it exists and is not expired."""
        if key in self.cache:
            value, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return value
            # Remove expired entry
            del self.cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        """Store a value in the cache with the current timestamp."""
        self.cache[key] = (value, time.time())

    def invalidate(self, key: str) -> None:
        """Remove a specific key from the cache."""
        if key in self.cache:
            del self.cache[key]

    def clear(self) -> None:
        """Clear all cache entries."""
        self.cache.clear()


class XPManager:
    """Manages XP operations and calculations."""

    def __init__(self, db: DatabaseManager, cache: Cache):
        self.db = db
        self.cache = cache

    def get_user_data(self, user_id: int, guild_id: int) -> dict:
        """Get a user's XP data, with caching."""
        cache_key = f"user:{user_id}:{guild_id}"

        # Check cache first
        cached_data = self.cache.get(cache_key)
        if cached_data:
            return cached_data

        # Get from database
        result = self.db.execute(
            "SELECT xp, level FROM users WHERE user_id=? AND guild_id=?",
            (user_id, guild_id),
        )

        if result:
            data = {"xp": result[0][0], "level": result[0][1]}
        else:
            # Initialize new user
            data = {"xp": 0, "level": 0}
            self.db.execute(
                "INSERT INTO users (user_id, guild_id, xp, level) VALUES (?, ?, 0, 0)",
                (user_id, guild_id),
            )

        # Cache the result
        self.cache.set(cache_key, data)
        return data

    def add_xp(self, user_id: int, guild_id: int, amount: int) -> dict:
        """Add XP to a user and update their level if needed."""
        user_data = self.get_user_data(user_id, guild_id)
        new_xp = user_data["xp"] + amount
        current_level = user_data["level"]

        # Calculate new level
        new_level = self.calculate_level(new_xp)
        leveled_up = new_level > current_level

        # Update database
        self.db.execute(
            "UPDATE users SET xp=?, level=? WHERE user_id=? AND guild_id=?",
            (new_xp, new_level, user_id, guild_id),
        )

        # Update cache
        updated_data = {"xp": new_xp, "level": new_level}
        self.cache.set(f"user:{user_id}:{guild_id}", updated_data)

        return {"data": updated_data, "leveled_up": leveled_up}

    def remove_xp(self, user_id: int, guild_id: int, amount: int) -> dict:
        """Remove XP from a user and update their level if needed."""
        user_data = self.get_user_data(user_id, guild_id)
        new_xp = max(0, user_data["xp"] - amount)  # Ensure XP doesn't go below 0
        current_level = user_data["level"]

        # Calculate new level
        new_level = self.calculate_level(new_xp)
        leveled_down = new_level < current_level

        # Update database
        self.db.execute(
            "UPDATE users SET xp=?, level=? WHERE user_id=? AND guild_id=?",
            (new_xp, new_level, user_id, guild_id),
        )

        # Update cache
        updated_data = {"xp": new_xp, "level": new_level}
        self.cache.set(f"user:{user_id}:{guild_id}", updated_data)

        return {"data": updated_data, "leveled_down": leveled_down}

    def get_multiplier(self, guild_id: int) -> float:
        """Get the current XP multiplier for a guild, considering expiration."""
        cache_key = f"multiplier:{guild_id}"

        # Check cache first
        cached_multiplier = self.cache.get(cache_key)
        if cached_multiplier is not None:
            return cached_multiplier

        # Get from database
        result = self.db.execute(
            "SELECT xp_multiplier, expires_at FROM settings WHERE guild_id=?",
            (guild_id,),
        )

        if not result:
            # Default multiplier
            return 1.0

        multiplier, expires_at = result[0]

        # Check if expired
        if expires_at and int(time.time()) > expires_at:
            # Reset to default
            self.db.execute(
                "UPDATE settings SET xp_multiplier=1.0, expires_at=NULL WHERE guild_id=?",
                (guild_id,),
            )
            multiplier = 1.0

        # Cache the result
        self.cache.set(cache_key, multiplier)
        return multiplier

    def set_multiplier(self, guild_id: int, value: float, minutes: int = 0) -> None:
        """Set the XP multiplier for a guild."""
        expires_at = None if minutes <= 0 else int(time.time()) + (minutes * 60)

        self.db.execute(
            """
            INSERT INTO settings (guild_id, xp_multiplier, expires_at)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id)
            DO UPDATE SET xp_multiplier=excluded.xp_multiplier, expires_at=excluded.expires_at
            """,
            (guild_id, value, expires_at),
        )

        # Update cache
        self.cache.set(f"multiplier:{guild_id}", value)

    def get_leaderboard(self, guild_id: int, limit: int = 10) -> List[tuple]:
        """Get the top users by XP for a guild."""
        return self.db.execute(
            "SELECT user_id, xp, level FROM users WHERE guild_id=? ORDER BY xp DESC LIMIT ?",
            (guild_id, limit),
        )

    def reset_guild_data(self, guild_id: int) -> int:
        """Reset all level data for a guild. Returns number of affected users."""
        result = self.db.execute("DELETE FROM users WHERE guild_id=?", (guild_id,))

        # Invalidate cache for this guild
        # A more sophisticated approach would be to track all keys related to this guild
        self.cache.clear()

        return len(result) if result else 0

    @staticmethod
    def calculate_level(xp: int) -> int:
        """Calculate level based on XP."""
        # Using the formula from the original code: level^4 = xp
        return int(xp**0.25)  # 4th root of xp

    @staticmethod
    def calculate_xp_for_level(level: int) -> int:
        """Calculate XP required for a specific level."""
        return level**4


def requires_moderator():
    """Decorator to check if user has moderator permissions."""

    async def predicate(interaction: discord.Interaction) -> bool:
        # Check for administrator permission
        if interaction.user.guild_permissions.administrator:
            return True

        # Check for moderator role
        moderator_role_id = CONFIG["roles"]["moderator"]
        if any(role.id == moderator_role_id for role in interaction.user.roles):
            return True

        await interaction.response.send_message(
            "You need moderator permissions to use this command.", ephemeral=True
        )
        return False

    return app_commands.check(predicate)


def requires_guild():
    """Decorator to check if command is used in a guild."""

    async def predicate(interaction: discord.Interaction) -> bool:
        if not interaction.guild:
            await interaction.response.send_message(
                "This command can only be used in a server.", ephemeral=True
            )
            return False
        return True

    return app_commands.check(predicate)


class LevelingCog(commands.Cog):
    """
    A cog that handles user leveling and XP management.
    Tracks user activity in text and voice channels and awards XP accordingly.
    """

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.db = DatabaseManager(CONFIG["database"]["path"])
        self.cache = Cache(CONFIG["cache"]["ttl"])
        self.xp_manager = XPManager(self.db, self.cache)

        # Start the voice XP loop
        self.voice_xp_loop.start()

    async def cog_unload(self):
        # Stop the task when the cog unloads
        self.voice_xp_loop.cancel()

        # Close all database connections
        for conn in self.db.connection_pool:
            conn.close()
        self.db.connection_pool.clear()

    @tasks.loop(minutes=1)
    async def voice_xp_loop(self):
        """Award XP to users in voice channels every minute."""
        # Wait until the bot is ready before starting the task
        await self.bot.wait_until_ready()

        # Batch updates for better performance
        xp_updates = []

        for guild in self.bot.guilds:
            try:
                # Get the XP multiplier for this guild
                multiplier = self.xp_manager.get_multiplier(guild.id)
                base_xp = CONFIG["xp"]["base_voice_xp"]
                xp_gain = int(base_xp * multiplier)

                if xp_gain <= 0:
                    continue  # Skip if no XP would be gained

                for vc in guild.voice_channels:
                    # Skip blacklisted channels
                    if vc.id in CONFIG["channels"]["blacklisted_voice"]:
                        continue

                    # Get members who aren't bots and aren't AFK
                    active_members = [
                        m
                        for m in vc.members
                        if not m.bot and not (m.voice and m.voice.afk)
                    ]

                    # Only award XP if there are at least the minimum required users in the channel
                    min_users = CONFIG["xp"]["min_voice_users"]
                    if len(active_members) >= min_users:
                        for member in active_members:
                            # Apply bonus for special channels
                            actual_xp = xp_gain
                            if vc.id in CONFIG["channels"]["bonus_channels"]:
                                actual_xp *= 2

                            # Add to batch update
                            xp_updates.append((member.id, guild.id, actual_xp))

            except (discord.HTTPException, sqlite3.Error) as e:
                print(f"Error in voice_xp_loop for guild {guild.id}: {e}")

        # Process all XP updates at once
        if xp_updates:
            try:
                for user_id, guild_id, amount in xp_updates:
                    result = self.xp_manager.add_xp(user_id, guild_id, amount)

                    # Check for level up - in a real implementation, this would send notifications
                    if result["leveled_up"]:
                        member = self.bot.get_guild(guild_id).get_member(user_id)
                        if member:
                            new_level = result["data"]["level"]
                            print(f"{member.display_name} leveled up to {new_level}!")
                            # In a real implementation, send level up message to appropriate channel

            except (discord.HTTPException, sqlite3.Error) as e:
                print(f"Error processing voice XP batch: {e}")

    @app_commands.command(
        name="rank", description="Check your rank or someone else's rank"
    )
    @app_commands.describe(user="The user whose rank you want to check")
    @requires_guild()
    async def rank(
        self, interaction: discord.Interaction, user: Optional[discord.Member] = None
    ):
        """Check the rank and XP of a user."""
        target_user = user or interaction.user

        try:
            # Get user data
            user_data = self.xp_manager.get_user_data(
                target_user.id, interaction.guild.id
            )
            xp = user_data["xp"]
            level = user_data["level"]

            # Calculate XP needed for next level
            next_level = level + 1
            next_level_xp = self.xp_manager.calculate_xp_for_level(next_level)
            xp_needed = next_level_xp - xp

            # Create embed
            embed = discord.Embed(
                title=f"{target_user.display_name}'s Rank", color=0x3498DB
            )
            embed.add_field(name="Level", value=f"**{level}**", inline=True)
            embed.add_field(name="XP", value=f"**{xp:,}**", inline=True)
            embed.add_field(
                name="Progress",
                value=f"**{xp:,}** / **{next_level_xp:,}** XP\n"
                f"**{xp_needed:,}** XP needed for Level {next_level}",
                inline=False,
            )

            # Set user avatar if available
            if target_user.avatar:
                embed.set_thumbnail(url=target_user.avatar.url)

            await interaction.response.send_message(embed=embed)

        except (discord.HTTPException, sqlite3.Error, ValueError) as e:
            print(f"Error in rank command: {e}")
            await interaction.response.send_message(
                "An error occurred while retrieving rank data.", ephemeral=True
            )

    @app_commands.command(name="top", description="Show the top users by XP")
    @app_commands.describe(count="Number of users to show (max 25)")
    @requires_guild()
    async def top(self, interaction: discord.Interaction, count: int = 10):
        """Show the top users by XP."""
        # Validate count parameter
        if count < 1:
            count = 1
        elif count > 25:
            count = 25

        try:
            # Get leaderboard data
            leaderboard = self.xp_manager.get_leaderboard(interaction.guild.id, count)

            if leaderboard:
                embed = discord.Embed(
                    title=f"Top {count} Users in {interaction.guild.name}",
                    description="Ranked by XP gained",
                    color=0xF1C40F,
                )

                for position, (user_id, xp, level) in enumerate(leaderboard, start=1):
                    # Try to get member information
                    member = interaction.guild.get_member(user_id)

                    if member:
                        name = member.display_name
                    else:
                        try:
                            # Attempt to fetch member if not in cache
                            member = await interaction.guild.fetch_member(user_id)
                            name = member.display_name
                        except discord.NotFound:
                            name = f"Unknown User ({user_id})"
                        except discord.HTTPException:
                            name = f"User {user_id}"

                    # Add to the leaderboard with formatting
                    medal = ""
                    if position == 1:
                        medal = "🥇 "
                    elif position == 2:
                        medal = "🥈 "
                    elif position == 3:
                        medal = "🥉 "

                    embed.add_field(
                        name=f"{medal}#{position}: {name}",
                        value=f"Level: **{level}** | XP: **{xp:,}**",
                        inline=False,
                    )

                await interaction.response.send_message(embed=embed)
            else:
                await interaction.response.send_message(
                    "No ranking data found for this server.", ephemeral=True
                )

        except (discord.HTTPException, sqlite3.Error, ValueError) as e:
            print(f"Error in top command: {e}")
            await interaction.response.send_message(
                "An error occurred while retrieving leaderboard data.", ephemeral=True
            )

    @app_commands.command(name="addxp", description="Add XP to a user")
    @app_commands.describe(user="The user to add XP to", amount="Amount of XP to add")
    @requires_guild()
    @requires_moderator()
    async def addxp(
        self, interaction: discord.Interaction, user: discord.Member, amount: int
    ):
        """Add XP to a user (moderator only)."""
        if amount <= 0:
            await interaction.response.send_message(
                "Please provide a positive amount of XP to add.", ephemeral=True
            )
            return

        try:
            # Add XP
            result = self.xp_manager.add_xp(user.id, interaction.guild.id, amount)

            await interaction.response.send_message(
                f"Added **{amount:,}** XP to {user.mention}.",
                allowed_mentions=discord.AllowedMentions.none(),
            )

            # Check for level up
            if result["leveled_up"]:
                new_level = result["data"]["level"]
                await interaction.followup.send(
                    f"🎉 {user.mention} leveled up to **Level {new_level}**!",
                    allowed_mentions=discord.AllowedMentions.none(),
                )

        except (discord.HTTPException, sqlite3.Error, ValueError) as e:
            print(f"Error in addxp command: {e}")
            await interaction.response.send_message(
                f"An error occurred while adding XP: {e}", ephemeral=True
            )

    @app_commands.command(name="removexp", description="Remove XP from a user")
    @app_commands.describe(
        user="The user to remove XP from", amount="Amount of XP to remove"
    )
    @requires_guild()
    @requires_moderator()
    async def removexp(
        self, interaction: discord.Interaction, user: discord.Member, amount: int
    ):
        """Remove XP from a user (moderator only)."""
        if amount <= 0:
            await interaction.response.send_message(
                "Please provide a positive amount of XP to remove.", ephemeral=True
            )
            return

        try:
            # Remove XP
            result = self.xp_manager.remove_xp(user.id, interaction.guild.id, amount)

            await interaction.response.send_message(
                f"Removed **{amount:,}** XP from {user.mention}.",
                allowed_mentions=discord.AllowedMentions.none(),
            )

            # Check for level down
            if result.get("leveled_down", False):
                new_level = result["data"]["level"]
                await interaction.followup.send(
                    f"{user.mention} dropped to **Level {new_level}**.",
                    allowed_mentions=discord.AllowedMentions.none(),
                )

        except (discord.HTTPException, sqlite3.Error, ValueError) as e:
            print(f"Error in removexp command: {e}")
            await interaction.response.send_message(
                f"An error occurred while removing XP: {e}", ephemeral=True
            )

    @app_commands.command(
        name="setmultiplier", description="Set the XP multiplier for this server"
    )
    @app_commands.describe(
        value="Multiplier value (0.1 or greater)",
        minutes="Duration in minutes (0 for permanent)",
    )
    @requires_guild()
    @requires_moderator()
    async def setmultiplier(
        self, interaction: discord.Interaction, value: float, minutes: int = 0
    ):
        """Set the XP multiplier for the server (moderator only)."""
        if value < 0.1:
            await interaction.response.send_message(
                "Multiplier must be 0.1 or greater.", ephemeral=True
            )
            return

        try:
            self.xp_manager.set_multiplier(interaction.guild.id, value, minutes)

            duration_text = "permanently" if minutes <= 0 else f"for {minutes} minutes"
            await interaction.response.send_message(
                f"Set XP multiplier to **{value}x** {duration_text}."
            )

        except (discord.HTTPException, sqlite3.Error, ValueError) as e:
            print(f"Error in setmultiplier command: {e}")
            await interaction.response.send_message(
                f"An error occurred while setting the multiplier: {e}", ephemeral=True
            )

    @app_commands.command(
        name="resetlevels", description="Reset all level data for this server"
    )
    @requires_guild()
    async def resetlevels(self, interaction: discord.Interaction):
        """Reset all level data for the server (admin only)."""
        # Check for administrator permissions
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message(
                "You need Administrator permissions to use this command.",
                ephemeral=True,
            )
            return

        # Create confirmation button ui
        class ConfirmView(discord.ui.View):
            def __init__(self, parent_cog):
                super().__init__(timeout=30.0)
                self.parent_cog = parent_cog
                self.value = None
                self.message = None

            @discord.ui.button(label="Reset All Data", style=discord.ButtonStyle.danger)
            async def confirm(
                self, interaction: discord.Interaction, _: discord.ui.Button
            ):
                self.value = True
                self.stop()

                # Disable all buttons
                for child in self.children:
                    child.disabled = True

                # Perform the reset
                try:
                    deleted_rows = self.parent_cog.xp_manager.reset_guild_data(
                        interaction.guild.id
                    )

                    success_embed = discord.Embed(
                        title="✅ Level Data Deleted",
                        description=f"All level data for {deleted_rows} users in this server has been deleted.",
                        color=discord.Color.green(),
                    )
                    await interaction.response.edit_message(
                        embed=success_embed, view=self
                    )
                except (discord.HTTPException, sqlite3.Error, ValueError) as e:
                    print(f"Error in resetlevels command: {e}")
                    error_embed = discord.Embed(
                        title="❌ Error",
                        description=f"An error occurred during deletion: {e}",
                        color=discord.Color.red(),
                    )
                    await interaction.response.edit_message(
                        embed=error_embed, view=self
                    )

            @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
            async def cancel(
                self, interaction: discord.Interaction, _: discord.ui.Button
            ):
                self.value = False
                self.stop()

                # Disable all buttons
                for child in self.children:
                    child.disabled = True

                cancel_embed = discord.Embed(
                    title="❌ Operation Cancelled",
                    description="No data was deleted.",
                    color=discord.Color.blurple(),
                )
                await interaction.response.edit_message(embed=cancel_embed, view=self)

            async def on_timeout(self):
                # Update the message when the view times out
                timeout_embed = discord.Embed(
                    title="⏰ Timeout",
                    description="Reset operation cancelled due to timeout.",
                    color=discord.Color.dark_gray(),
                )

                # Disable all buttons
                for child in self.children:
                    child.disabled = True

                # Try to edit the original message
                try:
                    await self.message.edit(embed=timeout_embed, view=self)
                except discord.HTTPException:
                    pass  # Original message might have been deleted

        # Create warning embed
        warning_embed = discord.Embed(
            title="⚠️ WARNING: Reset ALL Level Data?",
            description=(
                f"This will **permanently delete all level and XP data** "
                f"for **{interaction.guild.name}**.\n\n"
                f"This action cannot be undone!"
            ),
            color=discord.Color.red(),
        )

        # Create and send the view
        view = ConfirmView(self)
        await interaction.response.send_message(embed=warning_embed, view=view)

        # Store message for timeout handling
        message = await interaction.original_response()
        view.message = message

    # Event listeners
    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        """Award XP for messages."""
        # Skip if message is from a bot or not in a guild
        if message.author.bot or not message.guild:
            return

        # Get the multiplier for this guild
        multiplier = self.xp_manager.get_multiplier(message.guild.id)
        base_xp = CONFIG["xp"]["base_message_xp"]
        xp_gain = int(base_xp * multiplier)

        if xp_gain <= 0:
            return  # Skip if no XP would be gained

        # Check if message is in a special channel
        if message.channel.id in CONFIG["channels"]["bonus_channels"]:
            xp_gain *= 2

        # Add XP to the user
        result = self.xp_manager.add_xp(message.author.id, message.guild.id, xp_gain)

        # Check for level up
        if result["leveled_up"]:
            new_level = result["data"]["level"]
            await message.channel.send(
                f"🎉 {message.author.mention} leveled up to **Level {new_level}**!",
                allowed_mentions=discord.AllowedMentions.none(),
            )


# Setup function to add the Cog to the bot
async def setup(bot: commands.Bot):
    """Add the LevelingCog to the bot."""
    await bot.add_cog(LevelingCog(bot))
    print("LevelingCog loaded.")
