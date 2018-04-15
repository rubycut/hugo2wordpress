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

interface IHugoArticleOptions {
  filename: string
}

interface IHugoArticleYaml {
  title: string
  categories?: string[]
  tags?: string[]
  topics?: string[]
  date: Date
}
class HugoArticle {
  public content: string = ""
  public slug: string = ""
  public yaml: IHugoArticleYaml = { title: "", date: new Date() }
  private mdFilename: string

  constructor(options: IHugoArticleOptions) {
    this.mdFilename = options.filename
  }
  public load() {
    // TODO SUPPORT MULTIPLE FILES
    const filename = this.filename()
    // Get document, or throw exception on error
    const file = fs.readFileSync(filename, "utf8")
    const myYaml = file.split("---")[1]
    try {
      this.yaml = yaml.safeLoad(myYaml)
      this.slug = path.basename(filename).split(".")[0]
      const text = file.split("---")
      // remove first empty member
      text.shift()
      // remove yaml
      text.shift()
      // take the rest
      this.content = text.join("---")
      log.debug(this)
    } catch (e) {
      log.error(e)
    }
  }

  private filename(): string {
    return `${process.env.HUGO_HOME}/content/` + this.mdFilename
  }
}

export default HugoArticle
