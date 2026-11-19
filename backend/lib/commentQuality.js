// Match the whole response only. Additional details or questions are allowed.
export const genericCommentPhrases = [
  'good story', 'great story', 'nice story', 'excellent story', 'amazing story',
  'good chapter', 'great chapter', 'nice chapter', 'amazing chapter',
  'awesome', 'cool', 'nice', 'great', 'amazing', 'interesting',
  'i like it', 'i liked it', 'i love it', 'i loved it', 'i enjoyed it',
  'cool story', 'very good', 'really good', 'so good', 'well done',
  'more please', 'keep going', 'can’t wait for more', 'what happens next?',
  'okay', 'thanks', 'thank you', 'good job',
]

export const normalizeComment = text => text.normalize('NFKC').toLowerCase()
  .replace(/[’'ʼ]/gu, '')
  .replace(/[\p{P}\p{S}]/gu, ' ')
  .replace(/\s+/gu, ' ').trim()

const genericResponses = new Set(genericCommentPhrases.map(normalizeComment))
export const needsCommentDetail = body => typeof body === 'string' && genericResponses.has(normalizeComment(body))
export const COMMENT_DETAIL_MESSAGE = 'Share a question, prediction, or a specific moment or detail that stood out to you. Your response has been kept so you can add to it.'

export const MIN_COMMENT_CHARACTERS = 30
export const countCommentCharacters = body => Array.from(body.normalize('NFC').replace(/\p{Cf}/gu, '').replace(/\s+/gu, ' ').trim()).length

export const isObviousCommentSpam = body => {
  const text = body.normalize('NFKC').toLowerCase().replace(/\p{Cf}/gu, '').trim()
  if (!/\p{L}/u.test(text)) return true
  const compact = text.replace(/[\s\p{P}\p{S}]/gu, '')
  if (!compact) return true
  // Only block repetition dominating the whole response, not expressive words in a real sentence.
  const characters = Array.from(compact)
  const counts = new Map()
  for (const character of characters) counts.set(character, (counts.get(character) || 0) + 1)
  if (characters.length >= 8 && Math.max(...counts.values()) / characters.length >= 0.8) return true
  const words = text.match(/[\p{L}\p{N}]+/gu) || []
  const frequencies = new Map()
  for (const word of words) frequencies.set(word, (frequencies.get(word) || 0) + 1)
  if (words.length >= 4 && Math.max(...frequencies.values()) / words.length >= 0.8) return true
  if (compact.length >= 12 && /^(.{1,12})\1{2,}$/u.test(compact)) return true
  // Catch irregular home-row mashing too, not just exact repeated sequences.
  const mashWord = word => {
    if (/^(?:[asdfghjkl]{6,}|[qwertyuiop]{8,}|[zxcvbnm]{6,})$/u.test(word)) return true
    if (/^[a-z]{10,}$/.test(word)) {
      const vowels = (word.match(/[aeiouy]/g) || []).length
      if (vowels / word.length < 0.12) return true
    }
    return false
  }
  const mashedCharacters = words.filter(mashWord).reduce((sum, word) => sum + word.length, 0)
  if (compact.length >= 8 && (mashWord(compact) || mashedCharacters / compact.length >= 0.7)) return true
  const keyboardMash = /^(?:asdf(?:ghjkl)?|qwerty(?:uiop)?|zxcv(?:bnm)?|hjkl|qwer|asdfgh|jkl|123456)+$/u
  return words.length > 0 && words.filter(word => keyboardMash.test(word)).length / words.length >= 0.8
}

export const commentQualityMessage = body => {
  if (needsCommentDetail(body)) return COMMENT_DETAIL_MESSAGE
  if (isObviousCommentSpam(body)) return 'Please put your thought into words rather than repeated characters or keyboard patterns. A question, prediction, or detail from the chapter is a good place to start.'
  if (countCommentCharacters(body) < MIN_COMMENT_CHARACTERS) return `Please add a little more detail—at least ${MIN_COMMENT_CHARACTERS} characters. Try sharing a specific moment, question, or prediction.`
  return null
}
