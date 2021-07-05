const express = require('express')
const router = express.Router()

const fs = require('fs')
const request = require('request').defaults({ jar: true })
const govukTopics = require('./govuk-topics')
const url = require('url')
const nunjucks = require('nunjucks')

// Add your routes here - above the module.exports line

if (!process.env.API_URL) {
  console.warn('\n\n=== ERROR ============================')
  console.warn('You must set API_URL to specify the URL of the backend API')
  console.warn('for instance: API_URL=http://localhost:3050 npm start')
  console.warn('======================================\n\n')
  process.exit(-1)
}

const API_URL = process.env.API_URL

// ---- pre-fetch all topics titles  and descriptions

let mainstreamTopics, specialistTopics
govukTopics.fetchMainstreamTopics(body => { mainstreamTopics = body })
govukTopics.fetchSpecialistTopics(body => { specialistTopics = body })

// ---- Topic pages (both mainstream and specialist)

const topicPage = function (topicType, req, res) {
  const topicSlug = req.params.topicSlug
  const url = `${API_URL}/${topicType}/${topicSlug}`
  console.log(`requesting ${url}`)
  request(url, { json: true }, (_error, result, body) => {
    body.topicSlug = topicSlug
    if (body.organisations) {
      body.organisations = body.organisations.slice(0, 5)
    }
    if (body.latest_news) {
      body.latest_news = body.latest_news.slice(0, 3)
      body.latest_news.forEach(news => {
        const d = new Date(news.public_timestamp)
        news.date = `${d.getDate()}/${d.getMonth()}/${d.getFullYear()}`
        news.subtopic = news.subtopic === 'other' ? '' : news.subtopic.replace(/_/g, ' ')
        news.topic = news.topic === 'other' ? '' : news.topic.replace(/_/g, ' ')
      })
    }
    if (body.subtopics) {
      // Add the description of each subtopic from the appropriate topics global var
      body.subtopics = body.subtopics.map(sub => {
        console.log('SUBTOPIC')
        console.log(sub)

        // TODO: Hardcoded for now as we're only mocking one specialist topic for now
        if (sub.link === '/browse/visas-immigration/immigration-operational-guidance') {
          return { ...sub, description: 'Immigration Rules, forms and guidance for advisers' }
        }

        const topicList = topicType === 'browse' ? mainstreamTopics : specialistTopics
        return { ...sub, description: topicList.find(topic => topic._id === sub.link).description }
      })
    }
    res.render('topic', body)
  })
}

router.get('/browse/:topicSlug', function (req, res) {
  return topicPage('browse', req, res)
})


router.get('/topic/:topicSlug', function (req, res) {
  return topicPage('topic', req, res)
})

// ---- Mainstream subtopics

router.get('/browse/:topicSlug/:subTopicSlug', function (req, res) {
  const topicSlug = req.params.topicSlug
  const subTopicSlug = req.params.subTopicSlug
  const url = `${API_URL}/browse/${topicSlug}/${subTopicSlug}`
  console.log(`requesting ${url}`)
  request(url, { json: true }, (_error, result, body) => {
    body.topicSlug = topicSlug
    if (body.organisations) {
      body.organisations = body.organisations.slice(0, 5)
    }
    if (body.latest_news) {
      body.latest_news = body.latest_news.slice(0, 3)
      body.latest_news.forEach(news => {
        const d = new Date(news.public_timestamp)
        news.date = `${d.getDate()}/${d.getMonth()}/${d.getFullYear()}`
        news.subtopic = news.subtopic === 'other' ? '' : news.subtopic.replace(/_/g, ' ')
        news.topic = news.topic === 'other' ? '' : news.topic.replace(/_/g, ' ')
      })
    }
    res.render('sub_topic', body)
  })
})

// ---- Specialist subtopics

router.get('/topic/:topicSlug/:subTopicSlug', function (req, res) {
  const topicSlug = req.params.topicSlug
  const subTopicSlug = req.params.subTopicSlug
  const url = `${API_URL}/topic/${topicSlug}/${subTopicSlug}`
  console.log(`requesting ${url}`)
  request(url, { json: true }, (_error, result, body) => {
    body.topicSlug = topicSlug
    if (body.subtopics) {
      body.subtopics = body.subtopics.sort((a, b) => {
        if (a.title.toLowerCase() < b.title.toLowerCase()) return -1
        if (a.title > b.title) return 1
        return 0
      })
    }
    res.render('sub_topic', body)
  })
})

// ----------------------

router.get('/topic', function (req, res) {
  const url = `${API_URL}/topic`
  console.log(`requesting ${url}`)
  request(url, { json: true }, (error, results, body) => {
    if (error) throw error
    res.render('topics', body)
  })
})

router.get('/', function (req, res) {
  res.render('index')
})

// ==================================================
// All accounts stuff starts here

// GET SPRINT NAME - useful for relative templates
router.use('/', (req, res, next) => {
  var tempPrev = req.get('Referrer');
  if (tempPrev) {
    tempPrev = tempPrev.replace(/^[a-zA-Z]{3,5}\:\/{2}[a-zA-Z0-9_.:-]+\//, '');
  }
  req.session.data.previousURL = tempPrev; // previous screen
  next();
});

router.get('/layout_unbranded', function (req, res) {
  res.render('layout_unbranded')
})

router.get('/sign-in', function (req, res) {
  res.render('account/sign-in')
})

router.get('/sign-in-to-another-service', function (req, res) {
  res.render('account/sign-in-to-another-service')
})

router.all('/sign-in/set-cookie', function (req, res) {
  res.redirect('/account/home')
})

router.get('/sign-out', function (req, res) {
  if (req.session.data.signedIn) {
    delete req.session.data.signedIn
  }
  res.redirect('/')
})

router.get('/account/home', function (req, res) {
  res.render('account/home', { signedIn: 'true' })
})

router.get('/account/manage', function (req, res) {

  res.render('account/manage', { signedIn: 'true' })
})

router.all('/account/router-remove', function (req, res) {
  if (req.session.data.remove) {
    var tempRemove = req.session.data.remove;
    delete req.session.data.remove;

    req.session.data.notifications = req.session.data.notifications.filter(function (v, index) { return v !== tempRemove });
    req.session.data.bannerAlert = '/account/router-remove';
    return res.redirect(tempRemove + '#notification-success');
  }
})

router.all('/account/router-add', function (req, res) {
  var tempSave = req.session.data.save;

  if (!req.session.data.notifications) {
    req.session.data.notifications = [];
  }

  if (!req.session.data.notifications.includes(tempSave)) {
    req.session.data.notifications.unshift(tempSave);
  }

  delete req.session.data.save;
  req.session.data.bannerAlert = '/account/router-add';
  if (!req.session.data['signedIn']) {

    return res.redirect('/new-account/email')
  } else {
    return res.redirect(tempSave + '#notification-success')
  }
})

router.get('/new-account/email', function (req, res) {
  res.render('new-account/email')
})

router.get('/new-account/email-confirmation', function (req, res) {
  res.render('new-account/email-confirmation')
})

router.get('/new-account/index', function (req, res) {
  res.render('new-account/index')
})

router.get('/new-account/your-information', function (req, res) {
  res.render('new-account/your-information')
})

router.get('/new-account/confirm', function (req, res) {
  res.render('new-account/confirm', { signedIn: 'true' })
})

router.get('/account/other-accounts', function (req, res) {
  res.render('account/sign-in-to-another-service')
})

router.get('/includes/print-notifications', function (req, res) {
  res.render('includes/print-notifications')
})

router.get('/includes/banner', function (req, res) {
  res.render('includes/banner')
})

router.post('/search/router', function (req, res) {
  var string = req.session.data['keywords'].replace(/ /g, '+');
  res.redirect('/search/all?keywords=' + string + '&content_purpose_supergroup%5B%5D=services&order=relevance')
})

// All accounts routes end here
// ==================================================

// ==================================================
// All other URLs

// Modifies the body of all pages returned from gov.uk to add the Explore and Accounts elements
const augmentedBody = function (req, response, body) {
  const headerTemplate = fs.readFileSync('app/views/explore-header.html', 'utf8')
  const headerString = nunjucks.renderString(headerTemplate, { req, signedIn: req.session.data.signedIn })

  const headerStringWithCss = `
  <link href="/public/stylesheets/explore-header.css" media="all" rel="stylesheet" type="text/css" />
  <link href="/public/stylesheets/explore-govuk-overrides.css" media="all" rel="stylesheet" type="text/css" />
  <link href="/public/stylesheets/accounts.css" media="all" rel="stylesheet" type="text/css" />` + headerString

  const footerTemplate = fs.readFileSync('app/views/explore-footer.html', 'utf8')
  const notificationsBase = fs.readFileSync('app/views/includes/print-notifications.html', 'utf8')
  const notificationsTemplate = nunjucks.renderString(notificationsBase, { signedIn: req.session.data.signedIn, currentURL: req.url, notifications: req.session.data.notifications })

  var bannerAlert = req.session.data.bannerAlert; // only set from a router

  const topBannerHTML = fs.readFileSync('app/views/includes/banner.html', 'utf8')
  const topBannerTemplate = nunjucks.renderString(topBannerHTML, { previousURL: bannerAlert })


  const pageURL = req.url // this is a hack to get a unique identifer on each page

  if (bannerAlert) {
    delete req.session.data.bannerAlert; // should be a flash alert, can be removed once we've got the variable
  }

  // Make all src and ref attributes absolute, or the server will try to
  // fetch its own version
  return body
    .replace(/(href|src)="\//g, '$1="https://www.gov.uk/')
    .replace(/<body( class=")*?/, '<body class="explore-body ' + pageURL + '"')
    .replace(/<header[^]+?<\/header>/, headerStringWithCss)
    .replace(/<main role="main" id="content" class="detailed-guide" lang="en">/, topBannerTemplate + '<main role="main" id="content" class="detailed-guide" lang="en">')

    .replace(/<footer[^]+?<\/footer>/, footerTemplate)

    .replace(/<div class="gem-c-print-link[^]+?<\/div>/, notificationsTemplate)
    .replace(/<div class="gem-c-print-link[^]+?<\/div>/, notificationsTemplate) // hack to get bottom of page
    .replace(
      '<div class="govuk-header__container govuk-width-container">',
      '<div class="govuk-header__container govuk-header__container--old-page govuk-width-container">')

    .replace(/<\/body>/, '<script src="/public/javascripts/explore-header.js"></script>\n</body>')
    .replace(/<a(.*) href\s*=\s*(['"])\s*(https:)?\/\/www.gov.uk\//g, '<a $1 href=$2/')

}

// Constructs the URL to get the page body from on gov.uk
const govUkUrl = function (req) {
  var urlParts = new URL(req.url, 'https://www.gov.uk')
  var query = urlParts.search
  return 'https://www.gov.uk' + req.path + (query ? query : '')
}

router.all('*', (req, res, next) => {
  const log = {
    method: req.method,
    url: req.originalUrl,
    data: req.session.data
  }
  console.log(JSON.stringify(log, null, 2))

  next()
})

router.get('/*', function (req, res) {
  request(govUkUrl(req), function (error, response, body) {
    if (error) throw error
    if (response.headers['content-type'].indexOf('application/json') !== -1) {
      res.json(JSON.parse(body))
    } else {
      res.send(augmentedBody(req, response, body))
    }
  })
})

router.post('/*', function (req, res) {
  request.post({
    url: govUkUrl(req),
    followAllRedirects: true,
    formData: req.body
  }, function (error, response, body) {
    if (error) throw error

    res.send(augmentedBody(req, response, body))
  })
})

module.exports = router
