# Live Streaming - RTMP Integration (Future Enhancement)

**Date**: 2025-11-01
**Status**: Future Enhancement
**Priority**: Phase 5/6
**Estimated Effort**: 2-3 days

## Overview

Full live streaming implementation using RTMP ingest for OBS/broadcast software compatibility. Deferred from Phase 3 to follow YAGNI principle.

## Why Deferred

Phase 3 implements simplified MVP (metadata only):

- Stream lifecycle management (create/start/stop)
- Stream key generation
- Database records
- No actual video streaming yet

This document captures RTMP approach for future implementation.

## Architecture Options

### Option 1: nginx-rtmp (Self-hosted)

**Stack**:

- nginx with rtmp module
- FFmpeg for transcoding
- MinIO for storage

**Pros**:

- ✅ Full control
- ✅ No vendor lock-in
- ✅ Free (infrastructure only)
- ✅ OBS compatible

**Cons**:

- ❌ DevOps overhead
- ❌ Scaling complexity
- ❌ Need CDN for delivery

**Implementation**:

```yaml
# docker-compose.yml
nginx-rtmp:
  image: alfg/nginx-rtmp
  ports:
    - '1935:1935' # RTMP
    - '8080:8080' # HTTP-FLV
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
    - streams:/tmp/hls
```

```nginx
# nginx.conf
rtmp {
  server {
    listen 1935;

    application live {
      live on;
      record off;

      # HLS
      hls on;
      hls_path /tmp/hls;
      hls_fragment 3s;

      # Authentication
      on_publish http://api:3001/api/live/verify;

      # Callbacks
      on_publish_done http://api:3001/api/live/stop;
    }
  }
}
```

**API Changes**:

```typescript
// New endpoint for nginx auth
app.post('/api/live/verify', async (c) => {
  const { name } = await c.req.json() // stream key
  const video = await prisma.video.findFirst({
    where: { streamKey: name, videoType: 'LIVE' }
  })
  return video ? c.text('', 200) : c.text('', 403)
})
```

### Option 2: Cloudflare Stream Live

**Stack**:

- Cloudflare Stream API
- Webhook callbacks
- Zero infrastructure

**Pros**:

- ✅ Zero DevOps
- ✅ Global CDN
- ✅ Auto-scaling
- ✅ Built-in recording
- ✅ Multiple bitrates
- ✅ OBS compatible

**Cons**:

- ❌ Vendor lock-in
- ❌ Cost ($1/1000 mins + storage)
- ❌ API rate limits

**Implementation**:

```typescript
// Create live input
async createStream(title: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/live_inputs`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        meta: { name: title },
        recording: { mode: 'automatic' }
      })
    }
  )

  const { uid, rtmps, webRTC } = await response.json()

  return {
    videoId: nanoid(),
    streamKey: uid,
    rtmpUrl: rtmps.url,
    rtmpKey: rtmps.streamKey,
    webrtcUrl: webRTC.url
  }
}

// Webhook handler
app.post('/api/live/webhook/cloudflare', async (c) => {
  const event = await c.req.json()

  switch (event.type) {
    case 'live_input.connected':
      await prisma.video.update({
        where: { streamKey: event.uid },
        data: { status: 'LIVE', isLiveNow: true }
      })
      break

    case 'live_input.disconnected':
      await prisma.video.update({
        where: { streamKey: event.uid },
        data: { status: 'READY', isLiveNow: false }
      })
      break
  }

  return c.json({ success: true })
})
```

### Option 3: AWS IVS (Interactive Video Service)

**Stack**:

- AWS IVS for streaming
- S3 for recordings
- CloudFront for delivery

**Pros**:

- ✅ AWS ecosystem
- ✅ Low latency (<3s)
- ✅ Auto-scaling
- ✅ Built-in recording

**Cons**:

- ❌ AWS lock-in
- ❌ Complex pricing
- ❌ Learning curve

## Recommended Approach

**Phase 5**: Start with **Cloudflare Stream** (Option 2)

- Fastest time-to-market
- Zero infrastructure
- Production-ready immediately
- Can migrate to self-hosted later if needed

**Phase 6**: Migrate to **nginx-rtmp** (Option 1) if:

- Streaming costs >$500/month
- Need custom features
- Want full control

## Implementation Checklist

### Phase 5: Cloudflare Stream Integration

**Backend**:

- [ ] Get Cloudflare Stream API token
- [ ] Update `live.service.ts` with Cloudflare API calls
- [ ] Add webhook endpoint for stream events
- [ ] Update database schema (store Cloudflare UID)
- [ ] Test RTMP ingest with OBS
- [ ] Test webhook callbacks

**Frontend**:

- [ ] Display RTMP URL + stream key to streamer
- [ ] Embed Cloudflare player for viewers
- [ ] Show live indicator
- [ ] Viewer count (via Cloudflare API)

**Testing**:

- [ ] OBS ingest test
- [ ] Playback latency test
- [ ] Recording to VOD test
- [ ] Multi-bitrate test

### Phase 6: Self-hosted nginx-rtmp

**Infrastructure**:

- [ ] Set up nginx-rtmp Docker container
- [ ] Configure HLS output
- [ ] Set up CDN (CloudFlare/BunnyCDN)
- [ ] TURN/STUN servers for WebRTC fallback

**Backend**:

- [ ] Authentication callback endpoint
- [ ] Stream status callbacks
- [ ] HLS manifest serving
- [ ] Recording to MinIO

**Monitoring**:

- [ ] Stream health checks
- [ ] Bandwidth monitoring
- [ ] Viewer analytics
- [ ] Error alerting

## Environment Variables (Future)

```env
# Cloudflare Stream
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_WEBHOOK_SECRET=

# nginx-rtmp
RTMP_SERVER_URL=rtmp://stream.example.com/live
RTMP_HLS_PATH=/tmp/hls

# Optional: AWS IVS
AWS_IVS_CHANNEL_ARN=
AWS_IVS_REGION=
```

## Cost Estimates

### Cloudflare Stream

- Encoding: $1 per 1,000 minutes
- Storage: $5 per 1,000 minutes stored
- Delivery: $1 per 1,000 minutes delivered

**Example**: 100 concurrent viewers × 1 hour stream

- Cost: ~$100-150/month at scale

### Self-hosted nginx-rtmp

- Server: $40-100/month (4-8GB RAM)
- Bandwidth: $0.01-0.05/GB (CDN)
- Storage: Covered by existing MinIO

**Example**: Same load

- Cost: ~$50-80/month

## Migration Path

1. **Phase 3 (Now)**: Stream metadata only
2. **Phase 5**: Cloudflare Stream integration
3. **Phase 6**: Evaluate migration to self-hosted
4. **Ongoing**: Optimize based on usage

## References

- Cloudflare Stream Docs: https://developers.cloudflare.com/stream/
- nginx-rtmp Module: https://github.com/arut/nginx-rtmp-module
- OBS RTMP Guide: https://obsproject.com/wiki/Streaming-With-RTMP
- AWS IVS Docs: https://docs.aws.amazon.com/ivs/

## Unresolved Questions

- Support multiple quality levels (1080p/720p/480p)?
- Enable stream recording by default?
- Implement stream delay (for moderation)?
- Add stream chat functionality?
- DVR functionality (rewind live stream)?
