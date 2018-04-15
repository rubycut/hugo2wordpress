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

async function main(): Promise<any> {

  try {
    const hugoArticle = new HugoArticle({filename: process.argv[2]})
    hugoArticle.load()
    const wordpressArticle = new WordpressArticle(hugoArticle)
    wordpressArticle.push();
  } catch (err) {
    log.error(err)
  }

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
