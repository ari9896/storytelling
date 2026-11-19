import { useCallback, useEffect, useRef, useState } from 'react'
import ImageCropper from '../components/ImageCropper.jsx'

export const useImageCrop = () => {
  const [job, setJob] = useState(null)
  const pending = useRef(null)
  const prepareImage = useCallback((file, options = {}) => new Promise(resolve => {
    if (pending.current) { URL.revokeObjectURL(pending.current.previewUrl); pending.current.resolve(null) }
    const next = { id: crypto.randomUUID(), previewUrl: URL.createObjectURL(file), file, ...options, resolve }
    pending.current = next
    setJob(next)
  }), [])
  useEffect(() => () => { if (pending.current) { URL.revokeObjectURL(pending.current.previewUrl); pending.current.resolve(null); pending.current = null } }, [])
  const finish = file => {
    if (!job || pending.current?.id !== job.id) return
    URL.revokeObjectURL(job.previewUrl)
    pending.current = null
    setJob(null)
    job.resolve(file)
  }
  return { prepareImage, cropDialog: job ? <ImageCropper key={job.id} file={job.file} previewUrl={job.previewUrl} title={job.title} aspect={job.aspect} onConfirm={finish} onCancel={() => finish(null)} /> : null }
}
