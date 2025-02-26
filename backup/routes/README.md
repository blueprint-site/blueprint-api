# API Routes Documentation

Available API routes for the Blueprint services.

---

## Schematics Routes

Routes for schematics.

### Add a Schematic

- **Method:** POST
- **Endpoint:** `/schematics/add`
- **Description:** Adds a new schematic to the repository.
- **Body Required:** Yes
    - **Example:** `{ "name": "Castle", "description": "A large castle schematic." }`

### Get a Schematic

- **Method:** GET
- **Endpoint:** `/schematics/:id`
- **Description:** Retrieves a schematic by its unique ID.
- **Parameters:** `id` (schematic ID)

### Delete a Schematic

- **Method:** DELETE
- **Endpoint:** `/schematics/:id`
- **Description:** Deletes a schematic by its unique ID.
- **Parameters:** `id` (schematic ID)

---

## Addons Routes

Routes for addons.

### Get an Addon

- **Method:** GET
- **Endpoint:** `/addons/:id`
- **Description:** Retrieves details about a specific addon.
- **Parameters:** `id` (addon ID)

### Get All Addons

- **Method:** GET
- **Endpoint:** `/addons`
- **Description:** Retrieves a list of all available addons.