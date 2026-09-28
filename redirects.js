const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  const productsRedirect = {
    source: '/products',
    destination: '/shop',
    permanent: false,
  }

  const redirects = [productsRedirect, internetExplorerRedirect]

  return redirects
}

export default redirects
