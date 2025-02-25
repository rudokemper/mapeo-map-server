import createError from '@fastify/error'
import { HTTPError, RequestError } from 'got'

// TODO: Probably not the safest to use ENOTFOUND to indicate no internet access
export const OFFLINE_ERROR_CODES = ['ENOTFOUND', 'ENETUNREACH']

export const NotFoundError = createError(
  'FST_RESOURCE_NOT_FOUND',
  'Resource `%s` not found',
  404
)

export const AlreadyExistsError = createError(
  'FST_RESOURCE_EXISTS',
  'Resource with id `%s` already exists',
  409
)

export const UnsupportedSourceError = createError(
  'FST_UNSUPPORTED_SOURCE',
  'Invalid source: %s',
  400
)

export const MismatchedIdError = createError(
  'FST_MISMATCHED_ID',
  '`id` ("%s") in request URL does not match the `id` ("%s") in your tilejson',
  400
)

export const MBAccessTokenRequiredError = createError(
  'FST_ACCESS_TOKEN',
  'A Mapbox API access token is required for styles that use Mapbox-hosted sources',
  401
)

// Only format that is not supported right now is pbf
export const UnsupportedMBTilesFormatError = createError(
  'FST_UNSUPPORTED_MBTILES_FORMAT',
  '`format` must be `jpg`, `png`, or `webp`',
  400
)

export const MBTilesImportTargetMissingError = createError(
  'FST_MBTILES_IMPORT_TARGET_MISSING',
  'mbtiles file at `%s` could not be read',
  400
)

export const MBTilesInvalidMetadataError = createError(
  'FST_MBTILES_INVALID_METADATA',
  'mbtiles file has invalid metadata schema',
  400
)

export const MBTilesCannotReadError = createError(
  'FST_MBTILES_CANNOT_READ',
  'mbtiles file could not be read properly: %s',
  400
)

export const UpstreamJsonValidationError = createError(
  'FST_UPSTREAM_VALIDATION',
  'JSON validation failed for upstream resource from %s: %s',
  500
)

export const ParseError = createError(
  'PARSE_ERROR',
  'Cannot properly parse data',
  500
)

export const InvalidGlyphsRangeError = createError(
  'FST_INVALID_GLYPHS_RANGE',
  'Invalid range %s-%s',
  400
)

export const createForwardedUpstreamError = (statusCode: number) =>
  createError(
    `FST_FORWARDED_UPSTREAM`,
    'Request to %s errored with: %s',
    statusCode
  )

export function isOfflineError(err: unknown): err is RequestError {
  return err instanceof RequestError && OFFLINE_ERROR_CODES.includes(err.code)
}

export function isNotFoundError(err: unknown) {
  return (
    err instanceof NotFoundError ||
    (err instanceof HTTPError && err.response.statusCode === 404)
  )
}
