'use strict';

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? decodeXml(match[1]) : '';
}

async function searchGoogleNews(query) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new Error('A search query is required');
  }

  query = query.trim().slice(0, 200);

  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/rss+xml, application/xml, text/xml'
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error('Google News returned HTTP ' + response.status);
  }

  const xml = await response.text();

  if (!xml.includes('<rss') || xml.length > 1000000) {
    throw new Error('Google News returned an invalid or oversized feed');
  }

  const articles = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .slice(0, 15)
    .map(match => {
      const item = match[1];
      const sourceMatch = item.match(/<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/i);

      return {
        title: getTag(item, 'title'),
        url: getTag(item, 'link'),
        publishedAt: getTag(item, 'pubDate'),
        source: sourceMatch ? decodeXml(sourceMatch[2]) : ''
      };
    })
    .filter(article => article.title && /^https?:\/\//i.test(article.url));

  return {
    query,
    provider: 'Google News RSS',
    fetchedAt: new Date().toISOString(),
    count: articles.length,
    articles
  };
}


function isNewsRequest(message) {
  if (typeof message !== 'string') return false;
  const text = message.toLowerCase();

  return /\b(news|headlines|breaking news)\b/.test(text) ||
    /\b(latest|recent|breaking|current)\b.{0,70}\b(updates?|developments?|events?|stories|announcements?)\b/.test(text) ||
    /\b(what happened|what's happening|whats happening)\b.{0,50}\b(today|this week|recently|now)\b/.test(text);
}

module.exports = { searchGoogleNews, isNewsRequest };
