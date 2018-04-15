# Introduction

I decided to move my website from hugo to wordpress. Converting 300 articles manually was not much fun, I didn't find any tool which would be able to do . So, I wrote my own.

Enter hugo2wordpress

It took me an hour or two to write this utility, which will load my hugo article, convert it to wordpress article, and add it to drafts in wordpress. Then, all I need to do is press publish after I review that everything is converted correctly. 

# Status

This is just initial release, pull requests welcome. 

# Getting started

Install: ```npm install -g hugo2wordpress```
## Configure 

Create .env file in your current dir:

WP_URL=https://yourwebsite.com
WP_USERNAME=youremail@gmail.com
WP_PASSWORD=YOUR PASSWORD

HUGO_HOME=/Users/user/projects/web/yourwebsite.com

# Run to convert article

```node index.js <article>.md```
