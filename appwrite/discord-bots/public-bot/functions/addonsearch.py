"""Addon Search Functions"""

import os
import meilisearch
import dotenv

import discord

dotenv.load_dotenv()
try:
    client = meilisearch.Client(os.getenv("MEILISEARCH_URL"), os.getenv("SEARCH_TOKEN"))
    index = client.index("addons")
except (meilisearch.errors.MeiliSearchError, ConnectionError) as e:
    print(f"Error initializing Meilisearch: {e}")
    exit()

loaders = ["Forge", "NeoForge", "Fabric", "Quilt"]


async def addonsearch(interaction: discord.Interaction, query: str, limit: int = 1):
    """Search for addons based on the query and limit provided"""
    try:
        request = index.search(query, {"limit": limit})
        data = request.get("hits", [])
        await send_embeds(interaction, data)
        return data
    except meilisearch.errors.MeiliSearchError as e:
        print(f"Meilisearch error: {e}")
        return []


async def send_embeds(interaction: discord.Interaction, data: list[dict]):
    """Send embeds to the interaction"""
    for mod_data in data:
        try:
            embed = await gen_embed(mod_data)
            await interaction.followup.send(embed=embed)
        except discord.HTTPException as e:
            print(f"Discord HTTP error: {e}")


def format_loaders(loader_to_format: list[str]) -> str:
    """Format the loader_to_format into a string"""
    if not loader_to_format:
        return "No loaders available"
    return " ".join([f"{loader}" for loader in loader_to_format])


async def gen_embed(data: dict) -> discord.Embed:
    """Generate an embed from the data"""
    loaders_field = format_loaders(data.get("loaders", []))
    embed = discord.Embed(
        title="🟦 " + data["name"] + " 🟦",
        description=data["description"],
        color=0x689AEE,
    )
    embed.set_author(name="📋 ᴀᴜᴛʜᴏʀ : " + data["author"])
    embed.set_thumbnail(url=data["icon"])

    embed.add_field(name="🚀 ʟᴏᴀᴅᴇʀs", value=loaders_field, inline=False)
    embed.add_field(name="🔵 ᴀᴠᴀɪʟᴀʙʟᴇ ᴏɴ :", value="", inline=False)
    if data.get("modrinth_raw"):
        embed.add_field(name="", value="ᴍᴏᴅʀɪɴᴛʜ 🟢")

    if data.get("curseforge_raw"):
        embed.add_field(name="", value="ᴄᴜʀsᴇғᴏʀɢᴇ 🟠")

    embed.add_field(
        name="🔎 ɪɴғᴏs",
        value=f"https://nottelling.youthe.domain/addons/{data['slug']}",
        inline=False,
    )
    embed.set_footer(text=f" ⚡ {data['downloads']} ᴅᴏᴡɴʟᴏᴀᴅs")
    return embed
