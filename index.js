yaml = require('js-yaml');
fs   = require('fs');
request = require('request-promise-native');
const path = require('path');
const util = require('util');
const _ = require("lodash");
require("dotenv").config();


function fetch_article() {
  // TODO SUPPORT MULTIPLE FILES
  var filename = `${process.env.HUGO_HOME}/content/` + process.argv[2]
  // Get document, or throw exception on error
  var file = fs.readFileSync(filename, 'utf8')
  var my_yaml =  file.split("---")[1]
  var article
  try {
    article = yaml.safeLoad(my_yaml);
    article.slug = path.basename(filename).split(".")[0];
    text = file.split("---")
    // remove first empty member
    text.shift()
    // remove yaml
    text.shift()
    // take the rest
    article.content = text.join("---")
    console.log(article);
    return article
  } catch (e) {
    console.log(e);
  }
}

async function push_to_wordpress(article) {
  let response
  let new_article
  new_article = article.content.replace(/{{< youtube id="(.+)" >}}/g,'https://www.youtube.com/watch?v=$1')
  article.categories = _.compact(article.categories)
  article.tags = _.compact(article.tags)
  try {
    response = await request.post({
      url: `${process.env.WP_URL}/wp-json/wp/v2/posts`,
      auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD
      },
      json: true,
      body: {
        title: article.title,
        slug: article.slug,
        date: article.date,
        categories: article.categories,
        tags: article.tags,

        // TODO keep image names
        content: new_article,
      }
    })
  } catch(error) {
    console.log('error:', error); // Print the error if one occurred
  }

}
async function get_categories() {
  console.log("Let's get categories")
  let response
  try {
     response = await request.get({
    url: `${process.env.WP_URL}/wp-json/wp/v2/categories?per_page=100`,
    auth: {
      user: process.env.WP_USERNAME,
      password: process.env.WP_PASSWORD
    },
  })
  } catch(error) {
    console.log('error:', error); // Print the error if one occurred
  }
  let categories = yaml.safeLoad(response)
  //console.log(util.inspect(categories, { colors:true }))
  return categories
}
async function get_tags() {
  let response
  try {
     response = await request.get({
    url: `${process.env.WP_URL}/wp-json/wp/v2/tags?per_page=100`,
    auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD

    },
  })
  } catch(error) {
    console.log('error:', error); // Print the error if one occurred
  }
  let tags1 = yaml.safeLoad(response)

  try {
     response = await request.get({
    url: `${process.env.WP_URL}/wp-json/wp/v2/tags?per_page=100&page=2`,
    auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD

    },
  })
  } catch(error) {
    console.log('error:', error); // Print the error if one occurred
  }
  let tags2 = yaml.safeLoad(response)

  return _.union(tags1, tags2)
}

async function article_categories(article, categories) {
  if (article.categories && article.categories.length > 0) {
    console.log("continuing")
  } else {
    console.log("returning empty")
    return []
  }

  promises = article.categories.map(async (category) => {
    console.log("SEARCHING category", category)
    var hit = _.find(categories, {name: category})
    if (! hit ) {
      console.error(`${category} not found, creating...`)
      hit = await create_category(category)
    }
    console.log(hit.id)
    return hit.id
  })
  return Promise.all(promises)
}
async function article_tags(article) {
  var tags = await get_tags()
  //console.log("ARTICLE TAGS", article.tags)
  promises = article.tags.map(async (tag) => {
    console.log("SEARCHING for tag: ", util.inspect(tag, { colors:true }))
    var hit = _.find(tags, {name: tag})
    if (! hit ) {

      let response
      try {
        response = await request.get({
          url: `${process.env.WP_URL}/wp-json/wp/v2/tags?search=` + tag,
          auth: { 
                  user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD

          },
          json: true,
        })
      } catch(error) {
        console.log('error:', error); // Print the error if one occurred
      }
      if (response && response.length > 1 && response[0].name == tag) {
        hit = response[0]
      } else {
        console.error(`${tag} not found, creating...`, response)
        hit = await create_tag(tag)
      }


    }
    console.log(hit.id)
    return hit.id
  })
  return Promise.all(promises)
}
async function article_gurus(article,categories) {
  let promises = article.gurus.map(async (guru) => {
    console.log("SEARCHING for guru: ", guru)
    var hit = _.find(categories, {name: guru})
    if (! hit ) {
      console.error(`${guru} not found, creating...`)
      hit = await create_category(guru)
    }
    console.log(hit.id)
    return hit.id
  })
  return Promise.all(promises)
}
async function article_topics(article,categories) {
  let promises = article.topics.map(async (topic) => {
    console.log("SEARCHING for topic: ", topic)
    var hit = _.find(categories, {name: topic})
    if (! hit ) {
      console.log(categories)
      console.error(`${topic} not found, creating...`)
      hit = await create_category(topic)
    }
    console.log(hit.id)
    return hit.id
  })
  return Promise.all(promises)
}


async function main() {
  console.log("GO")
  let article
  try {
    article = fetch_article()
    if (! article.categories) {
      article.categories = ["article"]
    }
    let categories = await get_categories()
    console.log(util.inspect(categories, { colors:true }))

    article.categories = await article_categories(article, categories)

    if (article.tags && article.tags.length > 0) {
      article.tags = await article_tags(article)
    }
    if (article.gurus && article.gurus.length > 0) {
      var gurus = await article_gurus(article, categories)
      article.categories = _.union(article.categories, gurus)
    }
    if (article.topics && article.topics.length > 0) {
      var topics = await article_topics(article, categories)
      article.categories = _.union(article.categories, topics)
    }
  } catch(err) {
    console.error(err)
  }
  push_to_wordpress(article)
}


async function create_tag(tag_name) {
  console.log("Creating tag: ", tag_name)
  let response
  try {
    response = await request.post({
      url: `${process.env.WP_URL}/wp-json/wp/v2/tags`,
      auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD

      },
      json: true,
      body: {
        name: tag_name,
      }
    })
  } catch(error) {
    console.log('error while creating: ', tag_name)
    console.log('error:', error.message); // Print the error if one occurred
  }
  console.log("Created tag: ", tag_name)
  console.log("Response: ", response)
  return response
}
async function create_category(category_name) {
  console.log("Creating category: ", category_name)
  let response
  try {
    response = await request.post({
      url: `${process.env.WP_URL}/wp-json/wp/v2/categories`,
      auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD

      },
      json: true,
      body: {
        name: category_name,
      }
    })
  } catch(error) {
    console.log('error:', error); // Print the error if one occurred
  }
  console.log("Created category: ", category_name)
  return response
}


main()
