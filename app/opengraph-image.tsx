import { ImageResponse } from 'next/og'
import { getValidImageUrl } from '@/lib/utils/image-utils'

export const runtime = 'edge'

export const alt = 'exoDrive - Exotic Car Rentals in DMV'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image() {
  const imageUrl = getValidImageUrl('/exo_drive_og_image.png')

  return new ImageResponse(
    (
      <div
        style={{
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={imageUrl}
          alt="exoDrive - Exotic Car Rentals in DMV"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  )
} 