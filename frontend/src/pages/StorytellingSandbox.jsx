import InviteReaders from '../components/InviteReaders.jsx'
import StoryRating from '../components/StoryRating.jsx'
import CommentReactions from '../components/CommentReactions.jsx'
import UserCard from '../components/UserCard.jsx'
import EmojiPicker from '../components/EmojiPicker.jsx'
import { saveReadingPosition } from '../lib/readingProgress.js'
import CommentCharacterCount from '../components/CommentCharacterCount.jsx'
import CommentDetailHint from '../components/CommentDetailHint.jsx'
import { api, authError } from '../lib/api.js'
import ChapterCommentPrompt from '../components/ChapterCommentPrompt.jsx'
import { firstMissingComment } from '../lib/chapterAccess.js'
import { useAuth } from '../context/auth.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import StorySlides from '../components/StorySlides.jsx'

const StorytellingSandbox = ({ story, onProgressSaved }) => {
  const { user, loading, requireAccount } = useAuth()
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [inviting, setInviting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const requestedChapter = new URLSearchParams(location.search).get('chapter') || story.resumeChapterId
  const initialSlideIndex = Math.max(0, story.slides.findIndex(slide => slide.chapterId === requestedChapter && !slide.locked))
  const [deletingCommentId, setDeletingCommentId] = useState(null)
  const commentDeleteRef = useRef(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteInFlight = useRef(false)
  const [activeSlideIndex, setActiveSlideIndex] = useState(initialSlideIndex)
  const [discussion, setDiscussion] = useState(null)
  const [discussionError, setDiscussionError] = useState('')
  const [positionError, setPositionError] = useState('')
  const [postError, setPostError] = useState('')
  const [detailHint, setDetailHint] = useState(null)
  const [posting, setPosting] = useState(false)
  const postingRef = useRef(false)
  const accountId = user?._id || null
  const ready = discussion?.userId === accountId && discussion?.storyId === story.id
  const commentsByChapter = ready ? Object.fromEntries(discussion.chapters.map(chapter => [chapter.number, chapter.comments])) : {}
  const progressByChapter = ready ? Object.fromEntries(discussion.chapters.map(chapter => [chapter.number, chapter.hasCommented])) : {}
  useEffect(() => {
    if (loading) return undefined
    let active = true
    api.get(`/stories/${encodeURIComponent(story.id)}/discussion${accountId ? '' : '/public'}`)
      .then(({ data }) => { if (active) { setDiscussion({ ...data, storyId: story.id }); setDiscussionError('') } })
      .catch(failure => { if (active) setDiscussionError(authError(failure)) })
    return () => { active = false }
  }, [story.id, accountId, loading, activeSlideIndex])
  useEffect(() => {
    if (!ready || !location.hash.startsWith('#comment-')) return undefined
    const frame = requestAnimationFrame(() => {
      const comment = document.getElementById(location.hash.slice(1))
      comment?.focus({ preventScroll: true })
      comment?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, discussion, location.hash])
  const [restrictionNow, setRestrictionNow] = useState(() => Date.now())
  const commentRestriction = ready ? discussion.commentRestriction : user?.commentRestriction
  const commentingRestricted = commentRestriction?.status === 'indefinite' || (commentRestriction?.status === 'temporary' && new Date(commentRestriction.expiresAt).getTime() > restrictionNow)
  useEffect(() => {
    if (!ready || discussion.commentRestriction?.status !== 'temporary') return undefined
    const remaining = new Date(discussion.commentRestriction.expiresAt).getTime() - Date.now()
    if (remaining <= 0) return undefined
    const timer = setTimeout(() => setRestrictionNow(Date.now()), Math.min(2147483647, remaining))
    return () => clearTimeout(timer)
  }, [ready, discussion, restrictionNow])
  const [commentBody, setCommentBody] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyBody, setReplyBody] = useState('')
  const [requiredChapter, setRequiredChapter] = useState(null)
  const firstChapterIndex = story.slides.findIndex(slide => slide.type === 'story')
  const activeSlide = story.slides[!user && activeSlideIndex > firstChapterIndex ? firstChapterIndex : activeSlideIndex]
  const activeChapter = activeSlide.type === 'story' ? activeSlide.chapter : null
  const comments = activeChapter === null ? [] : commentsByChapter[activeChapter] || []

  const handleParagraphChange = useCallback((chapterId, paragraphIndex) => {
    if (!accountId) return
    saveReadingPosition(accountId, story.id, chapterId, paragraphIndex)
      .then(() => setPositionError(''))
      .catch(() => setPositionError('Your reading position could not be saved. It will retry as you read.'))
  }, [accountId, story.id])

  const handleSlideChange = (nextIndex) => {
    setActiveSlideIndex(nextIndex)
    setCommentBody('')
    setReplyBody('')
    setReplyingTo(null)
    setDetailHint(null)
  }

  const saveComment = async (body, parentId = null) => {
    if (!requireAccount('Sign up to join the discussion.')) return false
    if (postingRef.current || !ready || activeChapter === null || !body.trim()) return false
    const chapter = discussion.chapters.find(item => item.number === activeChapter)
    postingRef.current = true
    setPosting(true)
    setPostError('')
    setDetailHint(null)
    try {
      const { data } = await api.post(`/stories/${encodeURIComponent(story.id)}/chapters/${chapter.id}/comments`, { body, parentId })
      setDiscussion(current => current?.userId === accountId ? { ...current, chapters: current.chapters.map(item => item.id === data.chapterId ? { ...item, hasCommented: data.hasCommented, comments: data.comments } : item) } : current)
      setRequiredChapter(null)
      try { await onProgressSaved?.() } catch { setPostError('Comment saved, but the next chapter could not be loaded. Refresh to try again.') }
      return true
    } catch (failure) {
      if (failure.response?.data?.code === 'COMMENT_RESTRICTED') {
        setDiscussion(current => current ? { ...current, commentRestriction: failure.response.data.commentRestriction } : current)
        setPostError(authError(failure))
      } else if (failure.response?.data?.code === 'COMMENT_NEEDS_DETAIL') {
        setDetailHint({ target: parentId || 'comment', message: authError(failure) })
        requestAnimationFrame(() => document.getElementById(parentId ? `reply-${parentId}` : 'story-comment')?.focus({ preventScroll: true }))
      } else setPostError(authError(failure))
      return false
    } finally {
      postingRef.current = false
      setPosting(false)
    }
  }
  const addComment = async event => {
    event.preventDefault()
    if (await saveComment(commentBody)) setCommentBody('')
  }
  const addReply = async (event, parentId) => {
    event.preventDefault()
    if (await saveComment(replyBody, parentId)) { setReplyBody(''); setReplyingTo(null) }
  }

  const canOpenSlide = (nextIndex) => {
    if (user && !ready) { setPostError('Reading progress is still unavailable. Please wait or refresh to try again.'); return false }
    const missing = firstMissingComment(story.slides, nextIndex, user, commentsByChapter, story.requireAdminComment, progressByChapter, story.creatorId)
    if (!missing) {
      if (story.slides[nextIndex]?.locked) { setPostError('The next chapter is still locked or could not be refreshed. Please refresh and try again.'); return false }
      return true
    }
    setRequiredChapter(missing.chapter)
    return story.slides.findIndex(slide => slide.type === 'story' && slide.chapter === missing.chapter)
  }

  const deleteStory = async () => {
    if (deleteInFlight.current || !window.confirm('Remove this story from the library? The story, pictures, comments, and progress will be retained.')) return
    deleteInFlight.current = true
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/stories/${encodeURIComponent(story.id)}`)
      navigate('/', { replace: true })
    } catch (failure) { setDeleteError(authError(failure)) }
    finally { deleteInFlight.current = false; setDeleting(false) }
  }

  const deleteComment = async (commentId, mode) => {
    if (commentDeleteRef.current || user?.role !== 'admin' || !window.confirm(mode === 'hidden' ? 'Hide this comment and all its replies? They will remain stored in the database.' : 'Replace this comment with a moderation notice? Replies will stay visible.')) return
    const chapter = discussion?.chapters.find(item => item.number === activeChapter)
    if (!chapter) return
    commentDeleteRef.current = true
    setDeletingCommentId(commentId)
    setPostError('')
    try {
      const { data } = await api.delete(`/stories/${encodeURIComponent(story.id)}/chapters/${chapter.id}/comments/${commentId}`, { data: { mode } })
      const replace = comments => comments.filter(comment => !(data.hidden && comment.id === data.id)).map(comment => ({ ...comment, ...(comment.id === data.id ? data : {}), replies: replace(comment.replies || []) }))
      setDiscussion(current => current?.userId === accountId ? { ...current, chapters: current.chapters.map(item => item.id === chapter.id ? { ...item, comments: replace(item.comments) } : item) } : current)
    } catch (failure) { setPostError(authError(failure)) }
    finally { commentDeleteRef.current = false; setDeletingCommentId(null) }
  }

  const reactToComment = async (comment, emoji) => {
    const chapter = discussion?.chapters.find(item => item.number === activeChapter)
    if (!chapter || !ready) throw new Error('Discussion is still loading.')
    const { data } = await api.put(`/stories/${encodeURIComponent(story.id)}/chapters/${chapter.id}/comments/${comment.id}/reaction`, { emoji })
    const update = comments => comments.map(item => ({ ...item,
      ...(item.id === data.id ? { reactions: data.reactions, myReaction: data.myReaction } : {}), replies: update(item.replies || []),
    }))
    setDiscussion(current => current?.userId === accountId && current?.storyId === story.id ? {
      ...current, chapters: current.chapters.map(item => item.id === data.chapterId ? { ...item, comments: update(item.comments) } : item),
    } : current)
  }

  const renderComment = (comment, depth = 0) => (
    <article
      key={comment.id}
      id={`comment-${comment.id}`}
      tabIndex={-1}
      style={{ scrollMarginTop: 'calc(var(--site-header-height, 8rem) + 7rem)' }}
      className={depth === 0
        ? 'rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-slate-800 p-5'
        : depth === 1
          ? 'rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-100 dark:bg-sky-950 p-4'
          : 'rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-100 dark:bg-indigo-950 p-4'}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" disabled={!comment.authorId || comment.authorId === 'null'} onClick={() => setSelectedProfile(comment.authorId)} aria-label={`View ${comment.author}'s profile`} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          {comment.profilePic ? (
            <img src={comment.profilePic} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-sm font-bold text-blue-700 dark:text-blue-300">
              {comment.author.charAt(0).toUpperCase()}
            </span>
          )}
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100"><button type="button" disabled={!comment.authorId || comment.authorId === 'null'} onClick={() => setSelectedProfile(comment.authorId)} className="hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">{comment.author}</button></h3>
            {story.creatorId && comment.authorId === story.creatorId && <span className="shrink-0 rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">Author</span>}
          </div>
        </div>
        <time dateTime={comment.createdAt} className="ml-auto shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
          {new Date(comment.createdAt).toLocaleString()}
        </time>
      </div>
      <p className={`mt-3 whitespace-pre-wrap break-words ${comment.deleted ? 'italic text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{comment.body}</p>
      {!comment.deleted && <CommentReactions comment={comment} storyId={story.id} chapterId={activeSlide.chapterId} onProfile={setSelectedProfile} onReact={emoji => reactToComment(comment, emoji)} disabled={loading || !ready} restricted={commentingRestricted} />}
      {user?.role === 'admin' && <div className="mt-3 flex flex-wrap justify-end gap-2">
        {!comment.deleted && <button type="button" onClick={() => deleteComment(comment.id, 'notice')} disabled={!!deletingCommentId} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950 disabled:opacity-50">Replace with notice</button>}
        <button type="button" onClick={() => deleteComment(comment.id, 'hidden')} disabled={!!deletingCommentId} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950 disabled:opacity-50">{deletingCommentId === comment.id ? 'Deleting…' : 'Hide thread'}</button>
      </div>}

      {comment.replies.length > 0 && (
        <div className="mt-5 space-y-3 border-l-2 border-blue-200 dark:border-blue-900 pl-3 sm:pl-4">
          {comment.replies.map((reply) => renderComment(reply, depth + 1))}
        </div>
      )}

      {depth < 2 && (replyingTo === comment.id ? (
        <form onSubmit={(event) => addReply(event, comment.id)} className="mt-5">
          <label htmlFor={`reply-${comment.id}`} className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Reply to {comment.author}
          </label>
          <textarea
            id={`reply-${comment.id}`}
            value={replyBody}
            onChange={(event) => { setReplyBody(event.target.value); if (detailHint?.target === comment.id) setDetailHint(null) }}
            aria-describedby={`reply-count-${comment.id}${detailHint?.target === comment.id ? ` reply-detail-${comment.id}` : ''}`}
            maxLength={1000}
            rows={2}
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 dark:border-slate-600 p-3 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <EmojiPicker textareaId={`reply-${comment.id}`} value={replyBody} onChange={text => { setReplyBody(text); if (detailHint?.target === comment.id) setDetailHint(null) }} disabled={loading || posting || commentingRestricted} />
          <CommentCharacterCount id={`reply-count-${comment.id}`} value={replyBody} />
          {detailHint?.target === comment.id && <CommentDetailHint id={`reply-detail-${comment.id}`} message={detailHint.message} />}
          <div className="mt-2 flex gap-3">
            <button type="submit" disabled={loading || posting || commentingRestricted || (!!user && (!ready || !replyBody.trim()))} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700">
              Post reply
            </button>
            <button type="button" onClick={() => { setReplyingTo(null); setReplyBody(''); setDetailHint(null) }} className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setReplyingTo(comment.id); setReplyBody(''); setDetailHint(null) }} className="mt-4 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline">
          Reply
        </button>
      ))}
    </article>
  )

  return (
  <main className="mx-auto w-full max-w-5xl py-10">
    <div className="mb-6 flex flex-wrap items-center gap-4 sm:gap-6">
      <Link to="/#stories" className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline">← All stories</Link>
      {story.creatorId && user?._id === story.creatorId && <div className="flex flex-wrap items-center gap-3">
        <Link to={`/stories/${story.id}/edit`} className="inline-flex rounded-full border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 px-5 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 shadow-sm hover:bg-blue-50 dark:hover:bg-slate-800">Edit story</Link>
        <button type="button" onClick={() => setInviting(true)} className="inline-flex rounded-full border border-blue-200 bg-white px-5 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800">Invite readers</button>
        <button type="button" disabled={deleting || posting} onClick={deleteStory} className="rounded-full border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 px-5 py-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete story'}</button>
      </div>}
    </div>
    {deleteError && <p role="alert" className="mb-5 rounded-xl bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">{deleteError}</p>}
    <div className="mb-6 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{story.title}</h1><StoryRating value={story.contentRating} /></div>
    {positionError && <p role="status" className="mb-4 text-sm text-slate-500 dark:text-slate-400">{positionError}</p>}
    <StorySlides onParagraphChange={handleParagraphChange} resumeParagraphIndex={!location.search && !location.hash ? story.resumeParagraphIndex : null} following={ready && discussion.chapters.some(chapter => chapter.hasCommented)} initialIndex={initialSlideIndex} story={story} onSlideChange={handleSlideChange} canOpenSlide={canOpenSlide} />
    {requiredChapter !== null && <ChapterCommentPrompt chapter={requiredChapter} onClose={() => setRequiredChapter(null)} />}

    {activeChapter !== null && <section id="discussion" className="mt-8 scroll-mt-32 rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-lg md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Chapter {activeChapter}</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Discussion: {activeSlide.title}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Each chapter has its own comments. You can reply up to two levels deep; your comments and reading progress are saved to your account.
      </p>

      {!ready && !discussionError && <p role="status" className="mt-4 text-sm text-blue-700 dark:text-blue-300">Loading discussion and progress…</p>}
      {discussionError && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{discussionError} Refresh to try again.</p>}
      {postError && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{postError}</p>}
      {posting && <p role="status" className="mt-4 text-sm text-blue-700 dark:text-blue-300">Saving your comment…</p>}
      {commentingRestricted && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <p className="font-semibold">Commenting and replying are restricted for your account.</p>
        <p className="mt-2">{commentRestriction.status === 'temporary' ? `Access returns on ${new Date(commentRestriction.expiresAt).toLocaleString()}.` : 'An admin must restore your commenting access.'} Reason: {commentRestriction.reason}</p>
        <p className="mt-2">Your posts and reading progress are preserved. Further chapters still require comments to unlock.</p>
      </div>}
      <form onSubmit={addComment} className="mt-6">
        <label htmlFor="story-comment" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Add a comment
        </label>
        <textarea
          id="story-comment"
          value={commentBody}
          onChange={(event) => { setCommentBody(event.target.value); if (detailHint?.target === 'comment') setDetailHint(null) }}
          aria-describedby={`comment-character-count${detailHint?.target === 'comment' ? ' comment-detail-hint' : ''}`}
          maxLength={1000}
          rows={3}
          placeholder="What did you think of this chapter? Share a thought, ask a question, or tell us what you think might happen next."
          className="mt-2 w-full scroll-mt-32 resize-y rounded-xl border border-slate-300 dark:border-slate-600 p-3 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <EmojiPicker textareaId="story-comment" value={commentBody} onChange={text => { setCommentBody(text); if (detailHint?.target === 'comment') setDetailHint(null) }} disabled={loading || posting || commentingRestricted} />
        <CommentCharacterCount id="comment-character-count" value={commentBody} />
        {detailHint?.target === 'comment' && <CommentDetailHint id="comment-detail-hint" message={detailHint.message} />}
        <button
          type="submit"
          disabled={loading || posting || commentingRestricted || (!!user && (!ready || !commentBody.trim()))}
          className="mt-3 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
        >
          Post comment
        </button>
      </form>

      <div className="mt-8 space-y-5 border-t border-slate-200 dark:border-slate-700 pt-6">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No comments yet. Start the discussion above.</p>
        ) : comments.map((comment) => renderComment(comment))}
      </div>
    </section>}
    {inviting && <InviteReaders story={story} onClose={() => setInviting(false)} />}
    {selectedProfile && <UserCard key={selectedProfile} id={selectedProfile} onClose={() => setSelectedProfile(null)} />}
  </main>
  )
}

export default StorytellingSandbox
