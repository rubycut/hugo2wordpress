import dotenv from "dotenv"
import yaml from "js-yaml"
import * as _ from "lodash"
import path from "path"
import request from "request-promise-native"
import util from "util"
import HugoArticle from "./hugoArticle"

dotenv.config()

interface IWordpressArticleOption {
  hugoArticle: HugoArticle
}

interface IWordpressCategory {
  name: string
  id: number
}
interface IWordpressTag {
  name: string
  id: number
}

class WordpressArticle {
  public hugoArticle: HugoArticle
  public allCategories: IWordpressCategory[] = []
  public categories: number[] = []
  public tags: number[] = []

  constructor(options: IWordpressArticleOption) {
    this.hugoArticle = options.hugoArticle
  }

  public async push() {
    this.allCategories = await this.get_categories()
    log.trace(util.inspect(this.categories, { colors: true }))

    this.categories = await this.article_categories()

    if (this.hugoArticle.yaml.tags && this.hugoArticle.yaml.tags.length > 0) {
      this.tags = await this.article_tags()
    }
    log.debug("CHECK THIS", process.env.HUGO_CUSTOM_TAXONOMIES)
    const promises = _.get(process.env, "HUGO_CUSTOM_TAXONOMIES", "")
      .split(",")
      .map(async (taxonomy) => {
        log.debug("Checking custom taxonomy:", taxonomy)
        if (this.hugoArticle.yaml[taxonomy] && this.hugoArticle.yaml[taxonomy].length > 0) {
          const topics = await this.addCustomTaxonomy(taxonomy)
        }
      })
    await Promise.all(promises)
    this.hugoArticle.content = this.hugoArticle.content.replace(
      /{{< youtube id="(.+)" >}}/g,
      "https://www.youtube.com/watch?v=$1",
    )
    this.categories = _.compact(this.categories)
    this.tags = _.compact(this.tags)
    const body = {
      title: this.hugoArticle.yaml.title,
      slug: this.hugoArticle.slug,
      date: this.hugoArticle.yaml.date,
      categories: this.categories,
      tags: this.tags,
      // TODO keep image names
      content: this.hugoArticle.content,
    }
    log.error("Pushing wordpress:", body)
    try {
      // disable this while we do transition
      /*
    const response = await request.post({
      url: `${process.env.WP_URL}/wp-json/wp/v2/posts`,
      auth: {
        user: process.env.WP_USERNAME,
        password: process.env.WP_PASSWORD
      },
      json: true,
      body
    })
    */
    } catch (error) {
      log.error("error:", error) // Print the error if one occurred
    }
  }

  private async get_categories(): Promise<IWordpressCategory[]> {
    log.debug("Let's get wordpress categories")
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
      log.error(error) // Print the error if one occurred
    }

    const categories = yaml.safeLoad(response)
    // console.log(util.inspect(categories, { colors:true }))
    return categories
  }

  private async get_tags(): Promise<IWordpressTag[]> {
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
      log.error("error:", error) // Print the error if one occurred
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
      log.error("error:", error) // Print the error if one occurred
    }
    const tags2 = yaml.safeLoad(response)

    return _.union(tags1, tags2)
  }

  private async article_categories(): Promise<number[]> {
    if (this.hugoArticle.yaml.categories && this.hugoArticle.yaml.categories.length > 0) {
      log.trace("continuing")
    } else {
      log.trace("returning empty")
      return []
    }

    const promises = this.hugoArticle.yaml.categories.map(async (category) => {
      log.debug("SEARCHING category", category)
      let hit = _.find(this.allCategories, { name: category })
      if (hit === undefined) {
        log.error(`${category} not found, creating...`)
        hit = await this.create_category(category)
        return hit.id
      } else {
        log.debug(hit.id)
        return hit.id
      }
    })
    return Promise.all(promises)
  }
  private async article_tags(): Promise<number[]> {
    const tags = await this.get_tags()
    // console.log("ARTICLE TAGS", article.tags)
    if (this.hugoArticle.yaml.tags === undefined) {
      return []
    }
    const promises = this.hugoArticle.yaml.tags.map(async (tag) => {
      log.debug("SEARCHING for tag: ", util.inspect(tag, { colors: true }))
      const hit = _.find(tags, { name: tag })
      if (hit !== undefined) {
        log.warn("Tag found: ", tag, hit)
        return hit.id
      } else {
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
          log.error("error:", error) // Print the error if one occurred
        }
        let hit2
        if (response && response.length > 1 && response[0].name === tag) {
          hit2 = response[0]
        } else {
          log.error(`${tag} not found, creating...`, response)
          hit2 = await this.create_tag(tag)
        }
        log.trace(hit2.id)
        return hit2.id
      }
    })
    return Promise.all(promises)
  }
  private async addCustomTaxonomy(taxonomy: string) {
    if (!this.hugoArticle.yaml[taxonomy]) return []

    const promises: number[] = this.hugoArticle.yaml[taxonomy].map(async (term: string): Promise<
      number
    > => {
      log.debug(`SEARCHING for ${taxonomy}: `, term)
      let hit = _.find(this.allCategories, { name: term })
      if (!hit) {
        log.trace(this.allCategories)
        log.error(`${term} not found, creating...`)
        hit = await this.create_category(term)
      }
      log.trace(hit.id)
      return hit.id
    })
    const customCategories = await Promise.all(promises)
    this.categories = _.union(this.categories, customCategories)
  }

  private async create_tag(tagName: string): Promise<IWordpressTag> {
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
      log.error(error.message) // Print the error if one occurred
    }
    log.info("Created tag: ", tagName)
    log.debug("Response: ", response)
    return response
  }
  private async create_category(categoryName: string): Promise<IWordpressCategory> {
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
      log.error(error) // Print the error if one occurred
    }
    log.info("Created category: ", categoryName)
    return response
  }
}

export default WordpressArticle
