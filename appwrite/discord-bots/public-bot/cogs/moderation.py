"""Moderation commands for the bot."""

import json
import os
import requests

import discord
from discord import app_commands
from discord.ext import commands

MODERATOR_ROLE_ID = os.getenv("MODERATOR_ROLE_ID")
DEV_ROLE_ID = os.getenv("DEV_ROLE_ID")


# Moderation cog for commands that require elevated permissions
class ModerationCog(commands.Cog):
    """Moderation commands for the bot."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.config_path = "./config/replyingconfig.json"
        self.testing_url_path = "./config/testingurl.json"

        # Try to load config files
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error loading replyingconfig.json: {e}")
            self.config = {"autoreplying": {"enabled": True}}

        try:
            with open(self.testing_url_path, "r", encoding="utf-8") as f:
                self.testing_url = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error loading testingurl.json: {e}")
            self.testing_url = {"url": "https://example.com"}

    # Helper function to check moderator role
    async def is_moderator(self, interaction: discord.Interaction) -> bool:
        """Check if a user has the moderator role."""
        # Check for Discord's default admin permission first
        if interaction.user.guild_permissions.administrator:
            return True

        # Check if user has the moderator role
        if any(role.id == MODERATOR_ROLE_ID for role in interaction.user.roles):
            return True

        # If we get here, user doesn't have permission
        await interaction.response.send_message(
            "You don't have permission to use this command.", ephemeral=True
        )
        return False

    # Helper function to check developer role
    async def is_developer(self, interaction: discord.Interaction) -> bool:
        """Check if a user has the developer role."""
        # Check for Discord's default admin permission first
        if interaction.user.guild_permissions.administrator:
            return True

        # Check if user has the developer role
        if any(role.id == DEV_ROLE_ID for role in interaction.user.roles):
            return True

        # If we get here, user doesn't have permission
        await interaction.response.send_message(
            "You don't have permission to use this command.", ephemeral=True
        )
        return False

    # --- Auto-reply Commands ---

    @commands.command(name="syncguild")
    @commands.has_permissions(administrator=True)
    async def sync_guild_commands(self, ctx: commands.Context):
        """Sync slash commands to this guild only."""

        # Print debug info
        print(f"Syncing commands to guild {ctx.guild.name} (ID: {ctx.guild.id})")

        # Debug: Print all app commands registered in the tree
        bot_commands = self.bot.tree.get_commands()
        print(f"App commands found: {len(bot_commands)}")
        for cmd in bot_commands:
            print(f"  - {cmd.name}")

        if not ctx.guild:
            await ctx.send("This command must be used in a server.")
            return

        try:
            synced = await self.bot.tree.sync(guild=ctx.guild)
            await ctx.send(f"Synced {len(synced)} command(s) to this server!")
            print(
                f"Synced {len(synced)} command(s) to guild {ctx.guild.name} (ID: {ctx.guild.id})"
            )
        except discord.DiscordServerError as e:
            await ctx.send(f"Failed to sync commands: {e}")
            print(f"Error syncing commands to guild {ctx.guild.id}: {e}")
        except discord.HTTPException as e:
            await ctx.send(f"Failed to sync commands: {e}")
            print(f"Error syncing commands to guild {ctx.guild.id}: {e}")

    @commands.command(name="syncglobal")
    @commands.has_permissions(administrator=True)
    async def sync_global_commands(self, ctx: commands.Context):
        """Sync slash commands globally."""
        try:
            synced = await self.bot.tree.sync()
            await ctx.send(f"Synced {len(synced)} command(s) globally!")
            print(f"Synced {len(synced)} command(s) globally")
        except discord.HTTPException as e:
            await ctx.send(f"Failed to sync commands: {e}")
            print(f"Error syncing commands globally: {e}")

    @app_commands.command(name="replyon", description="Enable auto-replies")
    async def replyon(self, interaction: discord.Interaction):
        """Enable auto-replies."""
        # First check if the user has permission
        if not await self.is_moderator(interaction):
            return

        # Update config
        self.config["autoreplying"]["enabled"] = True

        # Save to file
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.config, f)
            await interaction.response.send_message(
                "Auto-replies have been enabled!", ephemeral=True
            )
        except (IOError, PermissionError, FileNotFoundError) as e:
            await interaction.response.send_message(
                f"Failed to save config: {e}", ephemeral=True
            )

    @app_commands.command(name="replyoff", description="Disable auto-replies")
    async def replyoff(self, interaction: discord.Interaction):
        """Disable auto-replies."""
        # First check if the user has permission
        if not await self.is_moderator(interaction):
            return

        # Update config
        self.config["autoreplying"]["enabled"] = False

        # Save to file
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.config, f)
            await interaction.response.send_message(
                "Auto-replies have been disabled!", ephemeral=True
            )
        except (IOError, PermissionError, FileNotFoundError) as e:
            await interaction.response.send_message(
                f"Failed to save config: {e}", ephemeral=True
            )

    # --- Testing Site Commands ---

    @app_commands.command(
        name="notifytesters", description="Send notification with test URL to testers"
    )
    async def notifytesters(self, interaction: discord.Interaction):
        """Notify testers of the testing URL."""
        # Check if used in the right server (dev server)
        if not interaction.guild or interaction.guild.id != 1232693376646643836:
            await interaction.response.send_message(
                "This command can only be used in the development server.",
                ephemeral=True,
            )
            return

        # Get URL from config
        try:
            with open(self.testing_url_path, "r", encoding="utf-8") as f:
                config = json.load(f)
            url = config["url"]
        except (FileNotFoundError, json.JSONDecodeError, KeyError) as e:
            await interaction.response.send_message(
                f"Failed to get testing URL: {e}", ephemeral=True
            )
            return

        # Create notification embed
        embed = discord.Embed(
            title="New testing URL", description=f"{url}", color=0xFF0000
        )
        embed.set_thumbnail(url="https://images.cooltext.com/5724188.gif")
        embed.set_author(
            name=f"{interaction.user.name}",
            icon_url=(
                interaction.user.display_avatar.url
                if interaction.user.display_avatar
                else None
            ),
        )
        embed.set_footer(text="Open the link and give us ur feedback pls")

        # Send to testing channel
        channel = self.bot.get_channel(1342156641843548182)
        if channel:
            await channel.send(embed=embed)
            await interaction.response.send_message(
                "Testing notification sent!", ephemeral=True
            )
        else:
            await interaction.response.send_message(
                "Could not find testing channel.", ephemeral=True
            )

    @app_commands.command(
        name="istesting", description="Update the testing site status"
    )
    @app_commands.describe(status="Whether the testing site is up or down")
    @app_commands.choices(
        status=[
            app_commands.Choice(name="Up - Ready for testing", value="up"),
            app_commands.Choice(name="Down - Not available", value="down"),
        ]
    )
    async def istesting(self, interaction: discord.Interaction, status: str):
        """Update whether the testing site is up or down."""
        # Get the announcement channel
        channel = self.bot.get_channel(1341080131841556532)
        if not channel:
            await interaction.response.send_message(
                "Could not find announcement channel.", ephemeral=True
            )
            return

        # Create and send appropriate embed
        if status.lower() == "up":
            embed = discord.Embed(
                title="Testing site is **up**",
                description="You can test it",
                color=0x63EEAA,
            )
            embed.set_footer(text="The URL is inside the testing-link channel")
            await channel.send(embed=embed)
            await interaction.response.send_message(
                "Testing site status set to UP!", ephemeral=True
            )
        elif status.lower() == "down":
            embed = discord.Embed(
                title="Testing site is **down**",
                description="You can't test it",
                color=0xFF5151,
            )
            embed.set_footer(text="The URL is inside the testing-link channel")
            await channel.send(embed=embed)
            await interaction.response.send_message(
                "Testing site status set to DOWN!", ephemeral=True
            )
        else:
            await interaction.response.send_message(
                "Invalid status. Use 'up' or 'down'.", ephemeral=True
            )

    @app_commands.command(name="testingurlset", description="Set the testing URL")
    @app_commands.describe(
        new_url="The new testing URL (must start with http:// or https://)"
    )
    async def testingurlset(self, interaction: discord.Interaction, new_url: str):
        """Set the testing URL."""
        # Check developer permissions
        if not await self.is_developer(interaction):
            return

        # Verify this is used in the dev server
        if not interaction.guild or interaction.guild.id != 1232693376646643836:
            await interaction.response.send_message(
                "Please don't set sensitive data in public servers.", ephemeral=True
            )
            try:
                await interaction.user.send(
                    "Please don't send sensitive data on the public server."
                )
            except discord.Forbidden:
                pass  # User might have DMs disabled
            return

        # Validate URL format
        if not (new_url.startswith("http://") or new_url.startswith("https://")):
            await interaction.response.send_message(
                "Please provide a valid URL starting with http:// or https://",
                ephemeral=True,
            )
            return

        # Update the testing URL
        try:
            # Load existing config first
            with open(self.testing_url_path, "r", encoding="utf-8") as f:
                config = json.load(f)

            # Update URL
            config["url"] = new_url

            # Save updated config
            with open(self.testing_url_path, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=4)

            await interaction.response.send_message(
                f"The testing URL has been updated to: {new_url}", ephemeral=True
            )
        except (IOError, json.JSONDecodeError, PermissionError) as e:
            await interaction.response.send_message(
                f"An error occurred while updating the URL: {str(e)}", ephemeral=True
            )

    @app_commands.command(
        name="testingurlget", description="Get the current testing URL"
    )
    async def testingurlget(self, interaction: discord.Interaction):
        """Get the current testing URL (DM only)."""
        # Verify this is used in the dev server
        if not interaction.guild or interaction.guild.id != 1232693376646643836:
            await interaction.response.send_message(
                "This command can only be used in the development server.",
                ephemeral=True,
            )
            return

        # Get and send the URL
        try:
            with open(self.testing_url_path, "r", encoding="utf-8") as f:
                config = json.load(f)

            # Send as DM for security
            try:
                await interaction.user.send(
                    f"The current testing URL is: {config['url']}"
                )
                await interaction.response.send_message(
                    "The testing URL has been sent to your DMs.", ephemeral=True
                )
            except discord.Forbidden:
                await interaction.response.send_message(
                    "I couldn't send you a DM. Please enable DMs from server members.",
                    ephemeral=True,
                )
        except (FileNotFoundError, json.JSONDecodeError, KeyError) as e:
            await interaction.response.send_message(
                f"An error occurred: {str(e)}", ephemeral=True
            )

    # --- Status Command ---

    @app_commands.command(name="status", description="Check Blueprint site status")
    async def status(self, interaction: discord.Interaction):
        """Check the status of Blueprint services."""
        # Let the user know we're checking statuses
        await interaction.response.defer(thinking=True)

        # Get statuses (with error handling)
        try:
            # Production site
            try:
                production_response = requests.get(
                    "https://blueprint-create.com", timeout=5
                )
                production = (
                    f"Online (Status: {production_response.status_code})"
                    if production_response.status_code == 200
                    else f"Issues detected (Status: {production_response.status_code})"
                )
            except (requests.RequestException, ConnectionError, TimeoutError) as e:
                production = f"Offline / Not working (Error: {str(e)[:50]}...)"

            # API
            try:
                api_url = os.getenv(
                    "PING2", "https://api.blueprint-create.com/health"
                )  # Fallback to common endpoint if env var missing
                api_response = requests.get(api_url, timeout=5)
                api = (
                    f"Online (Status: {api_response.status_code})"
                    if api_response.status_code == 200
                    else f"Issues detected (Status: {api_response.status_code})"
                )
            except (requests.RequestException, ConnectionError, TimeoutError) as e:
                api = f"Offline / Not working (Error: {str(e)[:50]}...)"

            # Meilisearch
            try:
                meili_url = os.getenv(
                    "PING1", "https://search.blueprint-create.com/health"
                )  # Fallback to common endpoint
                meili_response = requests.get(meili_url, timeout=5)
                meilisearch = (
                    f"Online (Status: {meili_response.status_code})"
                    if meili_response.status_code == 200
                    else f"Issues detected (Status: {meili_response.status_code})"
                )
            except (requests.RequestException, ConnectionError, TimeoutError) as e:
                meilisearch = f"Offline / Not working (Error: {str(e)[:50]}...)"

            # Legacy GitHub Pages site
            try:
                legacy_response = requests.get(
                    "https://blueprint-site.github.io/", timeout=5
                )
                production_gh = (
                    f"Online (Status: {legacy_response.status_code})"
                    if legacy_response.status_code == 200
                    else f"Issues detected (Status: {legacy_response.status_code})"
                )
            except (requests.RequestException, ConnectionError, TimeoutError) as e:
                production_gh = f"Offline / Not working (Error: {str(e)[:50]}...)"

            # Create the status embed
            embed = discord.Embed(title="The Blueprint Status", color=0x362D52)
            embed.add_field(name="Site (Production)", value=production, inline=False)
            embed.add_field(name="API", value=api, inline=False)
            embed.add_field(name="Meilisearch API", value=meilisearch, inline=False)
            embed.add_field(
                name="Site (Legacy, Github Pages)", value=production_gh, inline=False
            )
            embed.add_field(name="Bot", value="Online ✅", inline=False)

            # Add timestamp to show when check was performed
            embed.timestamp = discord.utils.utcnow()

            await interaction.followup.send(embed=embed)

        except (requests.RequestException, ConnectionError, ValueError, IOError) as e:
            await interaction.followup.send(
                f"An error occurred while checking statuses: {str(e)}"
            )


# Setup function to add the Cog to the bot
async def setup(bot: commands.Bot):
    await bot.add_cog(ModerationCog(bot))
    print("    ModerationCog loaded.")
