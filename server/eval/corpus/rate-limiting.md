# Rate limiting

A fixed window counter allows a set number of requests per time window, such as 100 per minute. It is simple but permits a burst of double the limit across a window boundary. A sliding window smooths this out by weighting the previous window.

The token bucket algorithm adds tokens to a bucket at a steady rate, and each request spends one token. It tolerates short bursts up to the bucket size while enforcing the long-term average rate, which is why many APIs use it.

When a client exceeds its limit, respond with HTTP 429 Too Many Requests. Include a `Retry-After` header telling the client how many seconds to wait before trying again. Well-behaved clients should back off exponentially with jitter.

For multiple server instances, keep counters in a shared store such as Redis so limits apply globally rather than per instance.
