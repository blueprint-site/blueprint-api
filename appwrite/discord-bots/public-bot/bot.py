import discord
from discord import app_commands
from discord.ext import commands
from colorama import Back, Style
from addonsearch import addonsearch
from schematicsearch import schematicsearch
import dotenv
import os

dotenv.load_dotenv()

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="??", intents=intents)

# Remove the old help command
bot.remove_command("help")

@bot.event
async def on_ready():
    # Synchronize slash commands with Discord
    await bot.tree.sync()
    print(f"{Back.GREEN}Logged in as {bot.user}{Style.RESET_ALL}")

@bot.tree.command(name="help", description="Displays the list of available commands")
async def help_command(interaction: discord.Interaction):
    embed = discord.Embed(
        title="Commands available",
        description="Addons & Schematics commands",
        color=discord.Color.blurple()
    )
    embed.add_field(
        name="Addon Commands",
        value="/addon search <query> [limit=1] - Search for addons on Blueprint.",
        inline=False
    )
    embed.add_field(
        name="Schematic Commands",
        value="/schematic search <query> [limit=1]",
        inline=False
    )
    embed.add_field(
        name="Data types",
        value="""
        <> - needed
        [] - optional
        """,
        inline=False
    )
    await interaction.response.send_message(embed=embed)

# Slash command for addon search
@bot.tree.command(name="addon", description="Manages commands related to addons")
async def addon_command(interaction: discord.Interaction, query: str, limit: int = 1):
    limit = max(1, min(limit, 5))
    
    # Defer the response to avoid InteractionResponded error
    await interaction.response.defer(ephemeral=True)
    
    # Search for addons
    await addonsearch(interaction=interaction, query=query, limit=limit)

# Slash command for schematic search
@bot.tree.command(name="schematic", description="Manages commands related to schematics")
async def schematic_command(interaction: discord.Interaction, query: str, limit: int = 1):
    limit = max(1, min(limit, 5))
    
    # Defer the response to avoid InteractionResponded error
    await interaction.response.defer(ephemeral=True)
    
    # Search for schematics
    await schematicsearch(interaction=interaction, query=query, limit=limit)

@bot.tree.command(name="link", description="Displays the link to the official website")
async def site_command(interaction: discord.Interaction):
    embed = discord.Embed(
        title="Official Website",
        description="Visit our website to discover more addons and schematics!",
        color=discord.Color.blue(),
        url="https://your-website.com"  # Replace with your actual URL
    )
    
    # Add an image to the embed (optional)
    embed.set_thumbnail(url="https://your-website.com/logo.png")  # Replace with your logo URL
    
    # Add additional information
    embed.add_field(
        name="Latest Updates",
        value="Check out the latest addons and schematics added to our site!",
        inline=False
    )
    
    embed.add_field(
        name="Support",
        value="Need help? Visit our forum or contact us directly on the site.",
        inline=False
    )
    
    # Add a footer
    embed.set_footer(text="© 2025 Your Name - All rights reserved")
    
    await interaction.response.send_message(embed=embed)

bot.run(os.getenv("PUBLIC_DISCORD_TOKEN"))