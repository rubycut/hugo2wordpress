import dotenv from "dotenv"
import fs from "fs"
import yaml from "js-yaml"
import * as _ from "lodash"
import logger from "loglevel-colored-level-prefix"
import path from "path"
import request from "request-promise-native"
import util from "util"

const log = logger()
log.setLevel("debug")
dotenv.config()

function fetch_article() {
  // TODO SUPPORT MULTIPLE FILES
  const filename = `${process.env.HUGO_HOME}/content/` + process.argv[2]
  // Get document, or throw exception on error
  const file = fs.readFileSync(filename, "utf8")
  const myYaml =  file.split("---")[1]
  let article
  try {
    article = yaml.safeLoad(myYaml);
    article.slug = path.basename(filename).split(".")[0];
    const text = file.split("---")
    // remove first empty member
    text.shift()
    // remove yaml
    text.shift()
    // take the rest
    article.content = text.join("---")
    log.debug(article);
    return article
  } catch (e) {
    log.error(e);
  }
}

async function push_to_wordpress(article) {
  const response
  const newArticle = article.content.replace(/{{< youtube id="(.+)" >}}/g, "https://www.youtube.com/watch?v=$1")
  article.categories = _.compact(article.categories)
  article.tags = _.compact(article.tags)
  try {
    // disable this while we do transition
    /*
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
        content: newArticle,
      }
    })
    */
  } catch (error) {
    log.error("error:", error); // Print the error if one occurred
  }

}
async function get_categories() {
  log.debug("Let's get categories")
  let response
  try {
     response = await request.get({
    url: `${process.env.WP_URL}/wp-json/wp/v2/categories?per_page=100`,
    auth: {
      user: process.env.WP_USERNAME,
      password: process.env.WP_PASSWORD,
    },
  })
  } catch (error) {
    log.error(error); // Print the error if one occurred
  }

  const categories = yaml.safeLoad(response)
  // console.log(util.inspect(categories, { colors:true }))
  return categories
}
async function get_tags() {
  let response
  try {
     response = await request.get({
    url: `${process.env.WP_URL}/wp-json/wp/v2/tags?per_page=100`,
    auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD,

    },
  })
  } catch (error) {
    log.error("error:", error); // Print the error if one occurred
  }
  const tags1 = yaml.safeLoad(response)

  try {
     response = await request.get({
    url: `${process.env.WP_URL}/wp-json/wp/v2/tags?per_page=100&page=2`,
    auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD,

    },
  })
  } catch (error) {
    log.error("error:", error); // Print the error if one occurred
  }
  const tags2 = yaml.safeLoad(response)

  return _.union(tags1, tags2)
}

async function article_categories(article, categories) {
  if (article.categories && article.categories.length > 0) {
    log.trace("continuing")
  } else {
    log.trace("returning empty")
    return []
  }

  const promises = article.categories.map(async (category) => {
    log.debug("SEARCHING category", category)
    let hit = _.find(categories, {name: category})
    if (! hit ) {
      log.error(`${category} not found, creating...`)
      hit = await create_category(category)
    }
    log.debug(hit.id)
    return hit.id
  })
  return Promise.all(promises)
}
async function article_tags(article) {
  const tags = await get_tags()
  // console.log("ARTICLE TAGS", article.tags)
  const promises = article.tags.map(async (tag) => {
    log.debug("SEARCHING for tag: ", util.inspect(tag, { colors: true }))
    let hit = _.find(tags, {name: tag})
    if (! hit ) {

      let response
      try {
        response = await request.get({
          url: `${process.env.WP_URL}/wp-json/wp/v2/tags?search=` + tag,
          auth: {
                  user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD,

          },
          json: true,
        })
      } catch (error) {
        log.error("error:", error); // Print the error if one occurred
      }
      if (response && response.length > 1 && response[0].name === tag) {
        hit = response[0]
      } else {
        log.error(`${tag} not found, creating...`, response)
        hit = await create_tag(tag)
      }

    }
    log.trace(hit.id)
    return hit.id
  })
  return Promise.all(promises)
}
async function article_topics(article, categories) {
  const promises = article.topics.map(async (topic) => {
    log.debug("SEARCHING for topic: ", topic)
    let hit = _.find(categories, {name: topic})
    if (! hit ) {
      log.trace(categories)
      log.error(`${topic} not found, creating...`)
      hit = await create_category(topic)
    }
    log.trace(hit.id)
    return hit.id
  })
  return Promise.all(promises)
}

async function main(): Promise<any> {
  let article
  try {
    article = fetch_article()
    if (! article.categories) {
      article.categories = ["article"]
    }
    const categories = await get_categories()
    log.debug(util.inspect(categories, { colors: true }))

    article.categories = await article_categories(article, categories)

    if (article.tags && article.tags.length > 0) {
      article.tags = await article_tags(article)
    }
    if (article.topics && article.topics.length > 0) {
      const topics = await article_topics(article, categories)
      article.categories = _.union(article.categories, topics)
    }
  } catch (err) {
    log.error(err)
  }
  push_to_wordpress(article)
}

async function create_tag(tagName) {
  log.info("Creating tag: ", tagName)
  let response
  try {
    response = await request.post({
      url: `${process.env.WP_URL}/wp-json/wp/v2/tags`,
      auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD,

      },
      json: true,
      body: {
        name: tagName,
      },
    })
  } catch (error) {
    log.error("error while creating: ", tagName)
    log.error(error.message); // Print the error if one occurred
  }
  log.info("Created tag: ", tagName)
  log.debug("Response: ", response)
  return response
}
async function create_category(categoryName) {
  log.info("Creating category: ", categoryName)
  let response
  try {
    response = await request.post({
      url: `${process.env.WP_URL}/wp-json/wp/v2/categories`,
      auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD,

      },
      json: true,
      body: {
        name: categoryName,
      },
    })
  } catch (error) {
    log.error(error); // Print the error if one occurred
  }
  log.info("Created category: ", categoryName)
  return response
}

main()
