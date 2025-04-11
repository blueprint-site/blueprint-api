"""Developer-only commands for the bot."""

import os
import json

import discord
from discord.ext import commands
from discord import app_commands  # For slash commands

OWNER_ID = os.getenv("OWNER_ID")
SERVER_ID = os.getenv("SERVER_ID")
CHANNEL_ID = os.getenv("CHANNEL_ID")
DEV_ROLE_ID = os.getenv("DEV_ROLE_ID")
NO_DEV_ROLE_MSG = "You need the Developer role to use this command."
DEV_SERVER_MSG = "This command can only be used in the developer server."


class DeveloperCog(commands.Cog):
    """
    Developer-only commands for the bot.
    Args:
        commands (commands.Bot): The bot instance to which this cog is attached.
    """

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.config_path = "./config/testingurl.json"  # Adjusted path slightly
        # Ensure owner_id is set on the bot instance for checks if needed elsewhere
        self.bot.owner_id = int(OWNER_ID) if OWNER_ID else None
        self.dev_role_id = int(DEV_ROLE_ID) if DEV_ROLE_ID else None
        self.server_id = int(SERVER_ID) if SERVER_ID else None
        self.channel_id = int(CHANNEL_ID) if CHANNEL_ID else None

        # Print out debug info
        print("Developer Cog initialized with settings:")
        print(f"Owner ID: {self.bot.owner_id}")
        print(f"Developer Role ID: {self.dev_role_id}")
        print(f"Server ID: {self.server_id}")
        print(f"Channel ID: {self.channel_id}")

    # --- Helper: Check if user is a dev ---
    def _is_dev(self, user: discord.User | discord.Member) -> bool:
        """Check if a user is a developer based on role or owner status"""
        if user.id == self.bot.owner_id:
            return True

        if isinstance(user, discord.Member) and self.dev_role_id:
            return any(role.id == self.dev_role_id for role in user.roles)

        return False

    # --- Helper for prefix commands (for backward compatibility) ---
    async def is_dev(self, ctx: commands.Context) -> bool:
        """Legacy method for prefix command checks"""
        if not ctx.guild:
            return False

        return self._is_dev(ctx.author)

    # --- Helper: Load/Save Config ---
    def _load_testing_config(self):
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # Return default structure if file missing or invalid
            return {"url": None}

    def _save_testing_config(self, config_data):
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(config_data, f, indent=4)
            return True
        except (OSError, IOError, TypeError) as e:
            print(f"Error saving testing config: {e}")
            return False


# Setup function to add the Cog to the bot
async def setup(bot: commands.Bot):
    """Setup function to add the Cog to the bot"""
    await bot.add_cog(DeveloperCog(bot))
    print("    DeveloperCog loaded.")
