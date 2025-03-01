import meilisearch
import discord
import os

# Load Meilisearch configuration from environment variables
# client = meilisearch.Client(os.getenv("MEILISEARCH_URL"), os.getenv("SEARCH_TOKEN"))
# index = client.index("schematics")

async def schematicsearch(interaction: discord.Interaction, query: str, limit: int = 1, page: int = 1):
    """
    # Searches for schematics in Meilisearch based on the provided query and sends the results as an embed.
    # Args:
    #     interaction (discord.Interaction): The Discord interaction object.
    #     query (str): The search query.
    #     limit (int, optional): The maximum number of results to return. Defaults to 1.
    #     page (int, optional): The page number of the results. Defaults to 1.
    """
    # Calculate the offset for pagination
    # offset = (page - 1) * limit
    # Perform the search in Meilisearch
    # request = index.search(query, {"limit": limit, "offset": offset})
    # Extract the hits from the search results
    # data = request.get("hits", [])

    # Send the search results as an embed
    # await send_embeds(interaction, data, ephemeral=True) # Comment out the original send_embeds call
    await send_feature_coming_soon_embed(interaction, ephemeral=True) # Call the new function

async def send_feature_coming_soon_embed(interaction: discord.Interaction, ephemeral: bool = False):
    """
    Sends an embed message indicating that the schematic search feature will be available in v2.

    Args:
        interaction (discord.Interaction): The Discord interaction object.
        ephemeral (bool, optional): Whether the message should be visible only to the user. Defaults to False.
    """
    embed = discord.Embed(
        title="Schematic Search Feature",
        description="This feature will be available with the v2 update!",
        color=discord.Color.blue()
    )
    await interaction.response.send_message(embed=embed, ephemeral=ephemeral)

async def send_embeds(interaction: discord.Interaction, data, ephemeral: bool = False):
    """
    # Sends the schematic search results as embeds.
    # Args:
    #     interaction (discord.Interaction): The Discord interaction object.
    #     data (list): The list of schematic data to send.
    #     ephemeral (bool, optional): Whether the message should be visible only to the user. Defaults to False.
    """
    # for mod_data in data:
    #     embed, view = await gen_embed(mod_data)
    #     await interaction.followup.send(embed=embed, view=view, ephemeral=ephemeral)  # Utiliser followup.send() après defer()
    pass

def format_loaders(loaders):
    """
    # Formats the list of mod loaders into a string.
    # Args:
    #     loaders (list): The list of mod loaders.
    # Returns:
    #     str: A string representing the formatted list of mod loaders.
    """
    # if not loaders:
    #     return "No loaders available"
    # return " ".join([f"{loader}" for loader in loaders])
    pass

async def gen_embed(data):
    """
    # Generates an embed message for a schematic.
    # Args:
    #     data (dict): The schematic data.
    # Returns:
    #     discord.Embed: The generated embed message.
    """
    # loaders_field = format_loaders(data.get("modloaders", []))
    # embed = discord.Embed(title=data["title"], description=data["description"], color=0x689AEE)
    # embed.set_author(name=data["$id"])
    # embed.set_thumbnail(url=data.get("image_urls", [None])[0])
    # embed.add_field(name="Loaders", value=loaders_field, inline=False)

    # # Create a button that links to the schematic's info page
    # url = f"https://nottelling.youthe.schematic/schematics/{data['slug']}"
    # button = discord.ui.Button(label="More Info", style=discord.ButtonStyle.link, url=url)

    # # Create a view and add the button to it
    # view = discord.ui.View()
    # view.add_item(button)

    # embed.add_field(name="Infos", value=url, inline=False)
    # embed.set_footer(text=f"Downloads: {data['downloads']}")
    # return embed, view
    pass
