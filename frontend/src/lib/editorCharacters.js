export const newCharacterSheet = () => ({ id: crypto.randomUUID(), name: '', notes: '', images: [] })
export const loadCharacterSheets = (characters = []) => characters.map(character => ({ ...character, characterId: character.id,
  images: character.images.map((image, index) => ({ ...image, id: `${character.id}-${index}` })),
}))
export const serializeCharacterSheets = async (characters, readFile) => Promise.all(characters.map(async character => ({
  ...(character.characterId ? { id: character.characterId } : {}), name: character.name, notes: character.notes,
  images: await Promise.all(character.images.map(async image => image.file
    ? { data: await readFile(image.file), explanation: image.explanation || '' }
    : { publicId: image.publicId, explanation: image.explanation || '' })),
})))
