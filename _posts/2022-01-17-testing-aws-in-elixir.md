---
layout: post
title: Testing AWS in Elixir
description: An overview of how to test Elixir applications that interact with AWS.
cover_image: cover-image.jpg
tags:
  - elixir
---

At Community we run most of our infrastructure and services on AWS. We use many different AWS services and many of our services interact with AWS directly, such as uploading and downloading files from S3, querying Athena, and more. Lately, I've been trying to improve how we *test* the interaction between our services and AWS, testing error conditions and edge cases as well as running reproducible integration tests. We'll talk about Localstack, mocks, ex_aws, and more.

{% include post_img.html alt="Cover image of a data center" name="cover-image.jpg" %}

{% include unsplash_credit.html name="Ian Battaglia" link="https://unsplash.com/@ianjbattaglia?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" %}

TODO
