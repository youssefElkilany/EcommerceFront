# Backend integration

Protected Next.js route handlers read the HTTP-only dorytos_session cookie and send Authorization as BEARER_KEY + token. The server-only BEARER_KEY value must match the backend exactly, including spaces. Configure it in local and Vercel environments.

## Cart

- Product cards show an add icon, then the cart quantity with increment/decrement controls. Decrementing from one removes the item.
- Existing card and cart-page quantities update optimistically, share the account cache, and use debounced PATCH /cart requests. Failed saves roll back the affected item.
- Product details use a manually entered quantity-to-add. POST /cart increments the quantity already saved; it does not replace it.
- Available additions subtract the existing cart quantity from stock, and controls respect the current backend quantity limit of 99. The backend still validates every request.

## Wishlist

GET, POST, and DELETE /user/wishlist return products belonging to the authenticated customer. The frontend proxies this products response using the HTTP-only session cookie and never stores account favorites in localStorage. Login/logout clears protected cached data.

The existing getWishlist controller is now registered as a GET route. Controller field references use whishList to match the existing user schema and storage. Product serialization and the user's controller flow are retained.
