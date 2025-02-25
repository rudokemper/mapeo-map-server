import { FastifyPluginAsync } from 'fastify'
import createError from '@fastify/error'
import got from 'got'
import { Static, Type as T } from '@sinclair/typebox'
import path from 'path'

import { normalizeStyleURL } from '../lib/mapbox_urls'
import { StyleJSON, createIdFromStyleUrl, validate } from '../lib/stylejson'
import {
  SpriteIndexSchema,
  UpstreamSpriteResponse,
  generateSpriteId,
  parseSpriteName,
} from '../lib/sprites'
import { getBaseApiUrl } from '../lib/utils'

const GetSpriteParamsSchema = T.Object({
  styleId: T.String(),
  spriteInfo: T.String(), // contains desired sprite id (and maybe pixel density)
})

const InvalidStyleError = createError(
  'FST_INVALID_STYLE',
  'Invalid style: %s',
  400
)

const InvalidRequestBodyError = createError(
  'FST_INVALID_REQUEST_BODY',
  'Invalid request body: %s',
  400
)

const FailedUpstreamFetchError = createError(
  'FST_UPSTREAM_FETCH',
  'Failed to fetch upstream resources from %s',
  500
)

function createInvalidStyleError(err: unknown) {
  return new InvalidStyleError((err as Error).message)
}

function validateStyle(style: unknown): asserts style is StyleJSON {
  try {
    validate(style)
  } catch (err) {
    throw createInvalidStyleError(err)
  }
}

const styles: FastifyPluginAsync = async function (fastify) {
  fastify.get<{
    Reply: {
      bytesStored: number
      id: string
      name: string | null
      url: string
    }[]
  }>('/', async function (request) {
    return this.api.listStyles(getBaseApiUrl(request))
  })

  fastify.post<{
    Body: { accessToken?: string } & (
      | { url: string }
      | { id?: string; style: StyleJSON }
    )
    Reply: { id: string; style: StyleJSON }
  }>('/', async function (request, reply) {
    let etag: string | undefined
    let id: string | undefined
    let style: unknown
    let upstreamUrl: string | undefined

    const { accessToken } = request.body

    if ('url' in request.body && request.body.url) {
      try {
        upstreamUrl = request.body.url

        id = createIdFromStyleUrl(upstreamUrl)

        // This will throw if the url is a mapbox style url and an access token is not provided
        // Ideally prevented via client-side code but just in case
        const normalizedUpstreamUrl = normalizeStyleURL(
          upstreamUrl,
          accessToken
        )

        const { body: fetchedStyle, headers } = await got(
          normalizedUpstreamUrl,
          { responseType: 'json' }
        )

        etag = headers.etag as string | undefined

        style = fetchedStyle
      } catch (err) {
        throw createInvalidStyleError(err)
      }
    } else if ('style' in request.body && request.body.style) {
      // Client can provide id to use for style since there's no good way of deterministically generating one in this case
      id = request.body.id
      style = request.body.style
    } else {
      throw new InvalidRequestBodyError(
        'Body must have one of the following fields: style, url'
      )
    }

    validateStyle(style)

    let upstreamSprites: Map<number, UpstreamSpriteResponse> | undefined

    if (style.sprite) {
      upstreamSprites = await this.api.fetchUpstreamSprites(style.sprite, {
        accessToken,
      })

      if (
        [...upstreamSprites.values()].every(
          (spriteInfo) => spriteInfo instanceof Error
        )
      ) {
        throw new FailedUpstreamFetchError(style.sprite)
      }
    }

    // TODO: Should we catch the missing access token issue before calling this?
    // i.e. check if `url` or any of `style.sources` are Mapbox urls
    // `createStyle` will catch these but may save resources in the db before that occurs
    const result = await this.api.createStyle(style, getBaseApiUrl(request), {
      accessToken,
      etag,
      id,
      upstreamUrl,
    })

    const spriteId = style.sprite ? generateSpriteId(style.sprite) : undefined

    if (spriteId && style.sprite && upstreamSprites?.size) {
      for (const [pixelDensity, spriteInfo] of upstreamSprites.entries()) {
        // TODO: Should we report the error here? Usually will be a validation error for the layout
        if (spriteInfo instanceof Error) continue

        this.api.createSprite({
          id: spriteId,
          data: spriteInfo.data,
          etag: spriteInfo.etag || null,
          layout: JSON.stringify(spriteInfo.layout),
          pixelDensity,
          upstreamUrl: style.sprite,
        })
      }
    }

    reply.header('Location', `${fastify.prefix}/${id}`)

    return result
  })

  fastify.get<{
    Params: {
      id: string
    }
    Reply: StyleJSON
  }>('/:id', async function (request) {
    return this.api.getStyle(request.params.id, getBaseApiUrl(request))
  })

  fastify.get<{
    Params: {
      id: string
    }
  }>('/:id/preview', function (request, reply) {
    reply.sendFile('map_preview.html', path.join(__dirname, '../public'))
  })

  fastify.delete<{
    Params: {
      id: string
    }
  }>(
    '/:id',
    {
      schema: {
        response: 204,
      },
    },
    async function (request, reply) {
      this.api.deleteStyle(request.params.id, getBaseApiUrl(request))
      reply.code(204).send()
    }
  )

  /**
   * Mapbox SDKs will send requests to json and png endpoints for a corresponding sprite url
   * https://docs.mapbox.com/mapbox-gl-js/style-spec/sprite/#loading-sprite-files
   */

  fastify.get<{
    Params: Static<typeof GetSpriteParamsSchema>
  }>(
    '/:styleId/sprites/:spriteInfo.png',
    {
      schema: {
        params: GetSpriteParamsSchema,
      },
    },
    async function (request, reply) {
      const { id, pixelDensity } = parseSpriteName(request.params.spriteInfo)
      const { data } = this.api.getSprite(id, pixelDensity, true)

      reply.header('Content-Type', 'image/png')
      reply.send(data)
    }
  )

  fastify.get<{
    Params: Static<typeof GetSpriteParamsSchema>
  }>(
    '/:styleId/sprites/:spriteInfo.json',
    {
      schema: {
        params: GetSpriteParamsSchema,
        response: {
          200: SpriteIndexSchema,
        },
      },
    },
    async function (request) {
      const { id, pixelDensity } = parseSpriteName(request.params.spriteInfo)

      const { layout } = this.api.getSprite(id, pixelDensity, true)

      return JSON.parse(layout)
    }
  )
}

export default styles
