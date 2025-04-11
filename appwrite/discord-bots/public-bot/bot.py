""" This is the main file for the bot. """
import os
import asyncio
import traceback
import dotenv
import discord
from discord.ext import commands

dotenv.load_dotenv()
TOKEN = os.getenv("PUBLIC_DISCORD_TOKEN")
GUILD_ID = os.getenv("GUILD_ID")

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!!", intents=intents, help_command=None)
bot.remove_command("help")


async def load_extensions():
    """Load cogs"""
    print("Loading cogs...")
    try:
        await bot.load_extension("cogs.general")
        await bot.load_extension("cogs.events")
        await bot.load_extension("cogs.developer")
        await bot.load_extension("cogs.moderation")
        await bot.load_extension("cogs.leveling")
        await bot.load_extension("cogs.search")
    except commands.ExtensionError as e:
        print(f"Failed to load cog: {type(e).__name__} - {e}")
    print("Cogs loaded.")

@bot.event
async def setup_hook():
    """Runs async setup before the bot logs in."""
    print("Running setup hook...")
    await load_extensions()
    print("Setup hook complete.")

    # Debug: Print all app commands registered in the tree
    print("Checking command tree...")
    app_commands = bot.tree.get_commands()
    print(f"App commands found: {len(app_commands)}")
    for cmd in app_commands:
        print(f"  - {cmd.name}")


@bot.event
async def on_ready():
    """Synchronize slash commands with Discord"""
    # In production, use the manual sync commands instead
    try:
        guild_commands = await bot.tree.sync()
        print(f"App command sync complete: {len(guild_commands)} commands registered.")
    except discord.DiscordServerError as e:
        print(f"Command sync failed: Discord server error: {e}")
    except discord.HTTPException as e:
        print(f"Command sync failed: HTTP error: {e}")
    except discord.DiscordException as e:
        print(f"Command sync failed: {e}")


async def main():
    """Main function to start the bot"""
    if TOKEN is None:
        print("ERROR: Bot token not found in .env file!")
        return

    try:
        print("Starting bot...")
        await bot.start(TOKEN)
    except discord.LoginFailure:
        print("ERROR: Improper token passed. Check your .env file.")
    except discord.PrivilegedIntentsRequired:
        print(
            "ERROR: Privileged Intents (Members/Message Content) are not enabled in the Developer Portal or here."
        )
    except discord.HTTPException as e:
        print(f"ERROR: HTTP request failed: {e}")
    except discord.ConnectionClosed as e:
        print(f"ERROR: Discord connection closed unexpectedly: {e}")
    except (RuntimeError, TypeError, ValueError, OSError) as e:
        print(f"CRITICAL ERROR: An unexpected error occurred: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot shutdown requested.")
