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
  const logoUrl = getValidImageUrl('/exodrive.svg', 'exoDrive Logo')

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
          alt="exoDrive Logo"
          style={{
            width: '400px',
            height: '400px',
            marginBottom: '20px',
            objectFit: 'contain',
          }}
        />
        <div
          style={{
            fontSize: 60,
            fontWeight: 'bold',
            color: '#000',
            textAlign: 'center',
          }}
        >
          exoDrive
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#666',
            textAlign: 'center',
            marginTop: '10px',
          }}
        >
          Exotic Car Rentals in DMV
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
} 