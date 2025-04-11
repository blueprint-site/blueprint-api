"""
This cog handles events, such as message processing and command suggestions.
"""

import random
import discord
from discord.ext import commands


class EventsCog(commands.Cog):
    """
    A Discord event handling cog that processes messages and provides command migration guidance.

    This cog listens to all messages, processes prefix commands, and occasionally suggests
    migrating from legacy prefix commands to new slash commands by providing helpful reminders.
    """

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # Use Cog.listener() for events
    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        """
        Processes incoming messages to handle prefix commands and suggest slash commands.

        Args:
            message (discord.Message): The message object representing the incoming message.
        """
        # Ignore bots
        if message.author == self.bot.user or message.author.bot:
            return

        # Process prefix commands
        await self.bot.process_commands(message)

        # Debug: Print received message for testing
        print(f"Message received from {message.author.name}: {message.content[:30]}...")

        # Check for old command usage and suggest slash commands instead
        # This helps users transition to the new slash command system
        if message.content.startswith("!!") and message.guild:
            command = message.content[2:].split(" ")[0].lower()

            # Mapping of old prefix commands to new slash commands
            command_mapping = {
                "yapping": "yapping",
                "wiki": "wiki",
                "plshelp": "wiki",
                "github": "github",
                "git": "github",
                "socials": "socials",
                "members": "members",
                "statusbot": "statusbot",
                "issue8ball": "issue8ball",
            }

            debug_commands = ["ping", "syncguild", "syncglobal", "cmdinfo"]

            if command in command_mapping and command not in debug_commands:
                # Only remind occasionally to avoid spamming
                if random.random() < 0.3:
                    slash_command = command_mapping[command]
                    await message.channel.send(
                        f"💡 **Tip:** We're moving to slash commands! Try using /{slash_command} instead of !!{command}",
                        delete_after=10,
                    )

async def setup(bot: commands.Bot):
    """ Add the EventsCog to the bot """
    await bot.add_cog(EventsCog(bot))
    print("    EventsCog loaded.")
