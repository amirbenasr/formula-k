/**
 * A failure the admin should read as a sentence, not a stack trace.
 *
 * `status` is what the endpoint answers with: 503 when the feature is not
 * configured on this server, 502 when the search provider is unhappy, 400 when
 * the request itself makes no sense. The UI prints `message` verbatim.
 */
export class CompetitorSearchError extends Error {
  status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'CompetitorSearchError'
    this.status = status
  }
}
