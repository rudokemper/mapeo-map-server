import { URL } from 'url'
import { createHash, randomBytes } from 'crypto'
import base32 from 'base32.js'
import { Type as T, TSchema, Static } from '@sinclair/typebox'
import { FastifyRequest } from 'fastify'

import { TileJSON } from './tilejson'

// Not cryptographically secure, but sha1 results in shorter / more manageable
// ids for filenames and in the URL, should be fine for our use-case
export function hash(data: string | Buffer): Buffer {
  return createHash('sha1').update(data).digest()
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return encodeBase32(randomBytes(16))
}

/**
 * Encode a buffer to base32
 */
export function encodeBase32(buf: Buffer): string {
  const encoder = new base32.Encoder({ type: 'crockford', lc: true })
  return encoder.write(buf).finalize()
}

/**
 * Generate an idempotent unique id for a given tilejson. Not all tilejson has
 * an id field, so we use the tile URL as an identifier (assumes two tilejsons
 * refering to the same tile URL are the same)
 */
export function getTilesetId(tilejson: TileJSON): string {
  // If the tilejson has no id, use the tile URL as the id
  const id = tilejson.id || tilejson.tiles.sort()[0]
  return encodeBase32(hash(id))
}

export function isFulfilledPromiseResult<T>(
  result: PromiseSettledResult<T>
): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled'
}

export function isRejectedPromiseResult(
  result: PromiseSettledResult<unknown>
): result is PromiseRejectedResult {
  return result.status === 'rejected'
}

export function getBaseApiUrl(request: FastifyRequest) {
  const { hostname, protocol } = request
  return `${protocol}://${hostname}`
}

// To work properly with OpenApi format
// https://github.com/sinclairzx81/typebox#unsafe-types
export const NullableSchema = <S extends TSchema>(schema: S) =>
  T.Unsafe<Static<S> | null>({ ...schema, nullable: true })

export function removeSearchParams(
  url: string,
  paramsToRemove: string[]
): string {
  const u = new URL(url)
  paramsToRemove.forEach((s) => u.searchParams.delete(s))
  return u.toString()
}

export function noop() {}
