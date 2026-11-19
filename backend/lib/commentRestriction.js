export const effectiveCommentRestriction = (user, now = new Date()) => {
  const restriction = user?.commentRestriction
  if (!restriction || restriction.status === 'none') return { status: 'none' }
  if (restriction.status === 'temporary' && (!restriction.expiresAt || new Date(restriction.expiresAt) <= now)) return { status: 'none' }
  return { status: restriction.status, reason: restriction.reason, expiresAt: restriction.status === 'temporary' ? restriction.expiresAt : null }
}
export const restrictionMessage = restriction => `Commenting and replying are ${restriction.status === 'temporary' ? `restricted until ${new Date(restriction.expiresAt).toISOString()}` : 'restricted until an admin restores access'}. Reason: ${restriction.reason}. Your existing reading progress is preserved, but new chapters still require comments to unlock.`
