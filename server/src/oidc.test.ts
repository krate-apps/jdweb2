import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertIdTokenClaims } from './oidc.js'

describe('assertIdTokenClaims', () => {
  const expected = { issuer: 'https://idp.example', clientId: 'jdweb' }
  const now = 1_700_000_000

  it('accepts a valid payload', () => {
    assert.doesNotThrow(() =>
      assertIdTokenClaims(
        { iss: expected.issuer, aud: expected.clientId, exp: now + 120 },
        expected,
        now,
      ),
    )
    assert.doesNotThrow(() =>
      assertIdTokenClaims(
        { iss: expected.issuer, aud: ['other', expected.clientId], exp: now + 120 },
        expected,
        now,
      ),
    )
  })

  it('rejects bad iss aud or exp', () => {
    assert.throws(
      () =>
        assertIdTokenClaims(
          { iss: 'https://evil', aud: expected.clientId, exp: now + 120 },
          expected,
          now,
        ),
      /oidc_invalid_token/,
    )
    assert.throws(
      () =>
        assertIdTokenClaims(
          { iss: expected.issuer, aud: 'other', exp: now + 120 },
          expected,
          now,
        ),
      /oidc_invalid_token/,
    )
    assert.throws(
      () =>
        assertIdTokenClaims(
          { iss: expected.issuer, aud: expected.clientId, exp: now - 120 },
          expected,
          now,
        ),
      /oidc_token_expired/,
    )
  })
})
