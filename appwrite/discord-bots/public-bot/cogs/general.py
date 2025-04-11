"""
This cog handles events such as message processing and command processing.
"""

import random

import discord
from discord import app_commands  # Required for slash commands
from discord.ext import commands


# Cog class for general commands
class GeneralCog(commands.Cog):
    """
    A Discord bot cog that handles general commands, including slash commands and prefix commands.
    This cog includes commands for debugging, information retrieval, and social media links.
    """

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.command(name="cmdinfo")
    async def command_info(self, ctx: commands.Context):
        """Show information about registered commands."""
        app_command_count = len(self.bot.tree.get_commands())
        prefix_command_count = len(self.bot.commands)

        embed = discord.Embed(title="Bot Command Information", color=0x00FF00)
        embed.add_field(
            name="Application (Slash) Commands",
            value=str(app_command_count),
            inline=True,
        )
        embed.add_field(
            name="Prefix Commands", value=str(prefix_command_count), inline=True
        )
        embed.add_field(
            name="Prefix", value=f"`{self.bot.command_prefix}`", inline=True
        )

        if app_command_count > 0:
            slash_cmd_names = ", ".join(
                [cmd.name for cmd in self.bot.tree.get_commands()]
            )
            embed.add_field(name="Slash Commands", value=slash_cmd_names, inline=False)

        await ctx.send(embed=embed)

    # --- Slash Commands ---

    @app_commands.command(name="help", description="List available slash commands")
    async def help_slash(self, interaction: discord.Interaction):
        """Shows the list of available slash commands"""
        embed = discord.Embed(
            title="Blueprint Bot Commands",
            description="Here are the available slash commands:",
            color=0x3498DB,
        )

        slash_commands = self.bot.tree.get_commands()
        slash_commands.sort(key=lambda x: x.name)

        # Add each command to the embed
        for cmd in slash_commands:
            embed.add_field(
                name=f"/{cmd.name}",
                value=cmd.description or "No description provided",
                inline=False,
            )

        embed.set_footer(
            text="💡 Use these commands by typing / and selecting from the list"
        )

        await interaction.response.send_message(embed=embed)

    @app_commands.command(
        name="ping",
        description="Simple ping command to check if the bot is responding.",
    )
    async def ping_slash(self, interaction: discord.Interaction):
        """Simple ping command to check if the bot is responding"""
        await interaction.response.send_message(
            f"Pong! 🏓 Bot latency: {round(self.bot.latency * 1000)}ms"
        )

    @app_commands.command(name="yapping", description="Tells people to calm down.")
    async def yapping_slash(self, interaction: discord.Interaction):
        """Tells people to calm down."""
        await interaction.response.send_message("Shhhh! Calm down!")

    @app_commands.command(
        name="statusbot", description="Checks if the bot is responding."
    )
    async def statusbot_slash(self, interaction: discord.Interaction):
        """Checks if the bot is responding."""
        embed = discord.Embed(title="Blueprint-Bot status", color=0x00CC73)
        embed.add_field(
            name="Uhhh", value="As you can see I responded, that means I'm online!"
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(
        name="wiki", description="Sends a link to the Blueprint wiki."
    )
    async def wiki_slash(self, interaction: discord.Interaction):
        """Sends a link to the Blueprint wiki."""
        await interaction.response.send_message("https://wiki.blueprint-create.com/")

    # Combining plshelp into wiki for slash commands makes sense
    # You could add an alias if needed, but separate command is redundant

    @app_commands.command(
        name="github", description="Sends a link to the Blueprint GitHub."
    )
    async def github_slash(self, interaction: discord.Interaction):
        """Sends a link to the Blueprint GitHub."""
        embed = discord.Embed(
            title="Our GitHub url!",
            description="Here: https://github.com/blueprint-site/blueprint-site.github.io",
            color=0x282828,
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(
        name="socials", description="Shows Blueprint social media links."
    )
    async def socials_slash(self, interaction: discord.Interaction):
        """Shows Blueprint social media links."""
        embed = discord.Embed(
            title="Our Socials!", description="check them out", color=0x1DA1F2
        )
        embed.add_field(
            name="X (twitter)", value="https://x.com/blueprint_site", inline=False
        )
        embed.add_field(
            name="Bluesky",
            value="https://bsky.app/profile/blueprint-site.bsky.social",
            inline=False,
        )
        embed.add_field(
            name="Mastodon",
            value="https://mastodon.social/@blueprint_site",
            inline=False,
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(
        name="issue8ball", description="Guess our resolution for your issue!"
    )
    @app_commands.describe(issue="Briefly describe the issue (optional)")
    async def issue8ball_slash(
        self, interaction: discord.Interaction, issue: str | None = None
    ):
        """A funny 8-ball command for issues"""
        # This command is a joke, so we don't need to do anything with the issue
        # The 'issue' arg isn't used by the logic, but good practice to include if describing
        responses = [
            "Will be fixed",
            "Will be fixed soon",
            "We will think on the resolution",
            "We will not fix this",
            "We don't know how to fix this",
            "I gotta ask MrSpinn",
            "Have you tried turning it off and on again?",
            "That's a feature, not a bug",
            "Sounds like a skill issue",
            "The bug has been promoted to a feature",
            "Error 404: Fix not found",
            "It works on my machine",
            "That's impossible, our code is perfect",
            "Let's call it a 'known limitation'",
            "The hamsters powering our servers need a break",
            "Mercury must be in retrograde",
            "Did you read the README?",
            "That's above my pay grade",
            "Have you tried asking Stack Overflow?",
            "Sounds like undefined behavior to me",
            "Let's put that in the backlog",
            "We'll fix it in the next major version",
            "That's not a bug, that's surprise functionality",
            "Working as intended™",
            "Let me forward that to /dev/null",
        ]

        embed = discord.Embed(
            title="The 8-ball has spoken! 🎱",
            description=random.choice(responses),
            color=0xFFD700,
        )
        embed.set_footer(
            text="The Blueprint team is not beholden to responses from this 8-ball. Use at your own risk."
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(
        name="members", description="Shows the current member count of the server."
    )
    async def members_slash(self, interaction: discord.Interaction):
        """Shows the current member count of the server."""
        if interaction.guild:  # Check if used in a server
            embed = discord.Embed(
                title="How many members on our discord?", color=0xFFD700
            )
            embed.add_field(
                name="This many:",
                value=f"{interaction.guild.member_count}",
                inline=False,
            )
            await interaction.response.send_message(embed=embed)
        else:
            # Ephemeral message only visible to the user
            await interaction.response.send_message(
                "This command can only be used in a server.", ephemeral=True
            )

    @app_commands.command(
        name="link", description="Displays the link to the official website"
    )
    async def site_command(self, interaction: discord.Interaction):
        """Displays the link to the official website"""
        embed = discord.Embed(
            title="Official Website",
            description="Visit our website to discover more addons and schematics!",
            color=discord.Color.blue(),
            url="https://your-website.com",  # Replace with your actual URL
        )

        # Add an image to the embed (optional)
        embed.set_thumbnail(
            url="https://your-website.com/logo.png"
        )  # Replace with your logo URL

        # Add additional information
        embed.add_field(
            name="Latest Updates",
            value="Check out the latest addons and schematics added to our site!",
            inline=False,
        )

        embed.add_field(
            name="Support",
            value="Need help? Visit our forum or contact us directly on the site.",
            inline=False,
        )

        # Add a footer
        embed.set_footer(text="© 2025 Your Name - All rights reserved")

        await interaction.response.send_message(embed=embed)


# Setup function to add the Cog to the bot
async def setup(bot: commands.Bot):
    """Add the GeneralCog to the bot."""
    await bot.add_cog(GeneralCog(bot))
    print("    GeneralCog loaded.")
