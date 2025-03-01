import discord
import meilisearch
import dotenv
import os

dotenv.load_dotenv()
try:
    client = meilisearch.Client(os.getenv("MEILISEARCH_URL"), os.getenv("SEARCH_TOKEN"))
    index = client.index("addons")
except Exception as e:
    print(f"Error initializing Meilisearch: {e}")
    exit()

loaders = ["Forge", "NeoForge", "Fabric", "Quilt"]


async def addonsearch(interaction: discord.Interaction, query: str, limit: int = 1, page: int = 1):
    offset = (page - 1) * limit  # Calculate the offset
    request = index.search(query, {"limit": limit, "offset": offset})
    data = request.get("hits", [])
    print(f"Meilisearch data: {data}")
    await send_embeds(interaction, data, ephemeral=True)
    return data


async def send_embeds(interaction: discord.Interaction, data: list[dict], ephemeral: bool = False):
    for mod_data in data:  # `data` est une liste de dictionnaires d'addons
        embed, view = await gen_embed(mod_data)
        await interaction.followup.send(embed=embed, view=view, ephemeral=ephemeral)


def format_loaders(loaders: list[str]) -> str:
    if not loaders:
        return "No loaders available"
    return " ".join([f"{loader}" for loader in loaders])


async def gen_embed(data: dict) -> tuple[discord.Embed, discord.ui.View]:
    loaders_field = format_loaders(data.get("loaders", []))
    embed = discord.Embed(title="🟦 " + data["name"] +" 🟦", description=data["description"], color=0x689AEE)
    embed.set_author(name="📋 ᴀᴜᴛʜᴏʀ : " + data["author"])
    embed.set_thumbnail(url=data["icon"])

    embed.add_field(name="ʟᴏᴀᴅᴇʀs", value=loaders_field, inline=False)
    embed.add_field(name="ᴀᴠᴀɪʟᴀʙʟᴇ ᴏɴ :", value="", inline=False)
    if data.get("modrinth_raw"):
     embed.add_field(name="", value=f'ᴍᴏᴅʀɪɴᴛʜ 🟢')

    if data.get("curseforge_raw"):
     embed.add_field(name="", value=f'ᴄᴜʀsᴇғᴏʀɢᴇ 🟠')

    # Create a button that links to the addon's info page
    url = f"https://blueprint-create.com/addons/{data['slug']}"
    button = discord.ui.Button(label="More Info", style=discord.ButtonStyle.link, url=url)

    # Create a view and add the button to it
    view = discord.ui.View()
    view.add_item(button)
    embed.set_footer(text=f" ⚡ {data['downloads']} ᴅᴏᴡɴʟᴏᴀᴅs")
    return embed, view
