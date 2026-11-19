const ImageBackdrop = ({ src }) => <>
  <img src={src} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full scale-110 select-none object-cover blur-md brightness-75" />
  <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/10" />
</>

export default ImageBackdrop
