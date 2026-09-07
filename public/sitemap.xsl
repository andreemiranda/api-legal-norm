<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
    xmlns:html="http://www.w3.org/TR/REC-html40"
    xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
    xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
      <head>
        <title>Sitemap XML - Norma Jurídica</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0b1329;
            color: #e2e8f0;
            margin: 0;
            padding: 30px;
          }
          .container {
            max-width: 1000px;
            margin: 0 auto;
            background-color: #111e38;
            border-radius: 12px;
            border: 1px solid #1e3a8a;
            padding: 28px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          }
          h1 {
            color: #60a5fa;
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          p.lead {
            color: #94a3b8;
            font-size: 14px;
            margin-bottom: 24px;
            line-height: 1.6;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th {
            background-color: #1e3a8a;
            color: #ffffff;
            text-align: left;
            padding: 10px 14px;
            font-weight: 600;
          }
          tr:nth-child(even) {
            background-color: #162447;
          }
          tr:hover {
            background-color: #1d3363;
          }
          td {
            padding: 10px 14px;
            border-bottom: 1px solid #1e293b;
            word-break: break-all;
          }
          a {
            color: #93c5fd;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
            color: #bfdbfe;
          }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 9999px;
            background-color: #1e3a8a;
            color: #93c5fd;
            font-size: 11px;
            font-weight: 600;
          }
          .footer {
            margin-top: 24px;
            font-size: 12px;
            color: #64748b;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Norma Jurídica — Mapa do Site (XML Sitemap)</h1>
          <p class="lead">
            Este arquivo XML indexa automaticamente os conteúdos editoriais, notícias legislativas, editorias temáticas e documentos regulatórios do portal <strong>Norma Jurídica</strong>.
          </p>

          <xsl:if test="sitemap:sitemapindex">
            <table>
              <thead>
                <tr>
                  <th>Sitemap Secundário</th>
                  <th>Última Modificação</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sitemap:sitemapindex/sitemap:sitemap">
                  <tr>
                    <td>
                      <a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a>
                    </td>
                    <td><xsl:value-of select="sitemap:lastmod"/></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </xsl:if>

          <xsl:if test="sitemap:urlset">
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Imagens</th>
                  <th>Prioridade</th>
                  <th>Frequência</th>
                  <th>Última Atualização</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sitemap:urlset/sitemap:url">
                  <tr>
                    <td>
                      <a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a>
                    </td>
                    <td>
                      <xsl:if test="count(image:image) &gt; 0">
                        <span class="badge"><xsl:value-of select="count(image:image)"/> img</span>
                      </xsl:if>
                    </td>
                    <td><xsl:value-of select="sitemap:priority"/></td>
                    <td><xsl:value-of select="sitemap:changefreq"/></td>
                    <td><xsl:value-of select="sitemap:lastmod"/></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </xsl:if>

          <div class="footer">
            Norma Jurídica © 2026 • Portal de Notícias e Legislação
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
