"""Search commands for the bot"""

import discord
from discord import app_commands
from discord.ext import commands

from functions.addonsearch import addonsearch
from functions.schematicsearch import schematicsearch


# Cog class for general commands
class SearchCog(commands.Cog):
    """
    A Discord bot cog that handles general commands, including slash commands and prefix commands.
    This cog includes commands for debugging, information retrieval, and social media links.
    """

    # Slash command for addon search
    @app_commands.command(
        name="addon", description="Manages commands related to addons"
    )
    async def addon_command(
        self, interaction: discord.Interaction, query: str, limit: int = 1
    ):
        """Search for addons based on the query and limit provided"""
        limit = max(1, min(limit, 5))
        await interaction.response.defer(ephemeral=True)
        await addonsearch(interaction=interaction, query=query, limit=limit)

    # Slash command for schematic search
    @app_commands.command(
        name="schematic", description="Manages commands related to schematics"
    )
    async def schematic_command(
        self, interaction: discord.Interaction, query: str, limit: int = 1
    ):
        """Search for schematics based on the query and limit provided"""
        limit = max(1, min(limit, 5))

        # Defer the response to avoid InteractionResponded error
        await interaction.response.defer(ephemeral=True)

        # Search for schematics
        await schematicsearch(interaction=interaction, query=query, limit=limit)


# Setup function to add the Cog to the bot
async def setup(bot: commands.Bot):
    """Add the SearchCog to the bot."""
    await bot.add_cog(SearchCog(bot))
    print("    SearchCog loaded.")
