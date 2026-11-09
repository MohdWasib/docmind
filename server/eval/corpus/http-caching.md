# HTTP caching

The Cache-Control response header tells browsers and CDNs how long they may reuse a response. `max-age=3600` means the response stays fresh for one hour, and `no-store` forbids caching entirely. The `stale-while-revalidate` directive lets a cache serve an expired response immediately while it fetches a fresh copy in the background.

An ETag is a fingerprint of a response body. When a cached copy expires, the browser sends the ETag back in an `If-None-Match` request header. If the content has not changed, the server replies with status 304 Not Modified and no body, saving bandwidth. Last-Modified with If-Modified-Since works the same way using timestamps.

Fingerprinted static assets such as `app.3f9a1c.js` can be cached for a year with the `immutable` directive, because any change produces a new filename.
