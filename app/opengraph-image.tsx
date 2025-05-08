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
  const logoUrl = getValidImageUrl('/@exo_drive_og_image.png', 'exoDrive OG Image')

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        <img
          src={logoUrl}
          alt="exoDrive OG Image"
          style={{
            width: '1000px',
            height: 'auto',
            marginBottom: '20px',
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  )
} 