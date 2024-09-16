// yourFunctionsFile.js
const fetch = require('node-fetch');

// Function to fetch a WordPress post by ID
async function fetchPost(postId, wordpressSiteUrl) {
  const apiUrl = `${wordpressSiteUrl}/wp-json/wp/v2/posts/${postId}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Error fetching post: ${response.statusText}`);
  }
  const post = await response.json();
  return post;
}

// Function to extract image URLs from post content
function extractImageUrls(content) {
  const regex = /<img[^>]+src="([^">]+)"/g;
  let matches;
  const imageUrls = [];
  while ((matches = regex.exec(content)) !== null) {
    imageUrls.push(matches[1]);
  }
  return imageUrls;
}

// Function to search media library for a specific image URL
async function searchMedia(imageUrl, wordpressSiteUrl) {
  const encodedImageUrl = encodeURIComponent(imageUrl);
  const apiUrl = `${wordpressSiteUrl}/wp-json/wp/v2/media?search=${encodedImageUrl}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Error searching media: ${response.statusText}`);
  }
  const mediaItems = await response.json();
  const associatedPostIds = [];

  // Iterate through media items to find associated posts
  for (const media of mediaItems) {
    // Adjust the logic based on how your WordPress associates media with posts
    if (media.post) {
      associatedPostIds.push(media.post);
    }
  }

  return associatedPostIds;
}

// Main function to execute the workflow
async function main(input) {
  const { postId, wordpressSiteUrl } = input;

  // Step 1: Fetch the post
  const post = await fetchPost(postId, wordpressSiteUrl);

  // Step 2: Extract image URLs
  const imageUrls = extractImageUrls(post.content.rendered);

  // Step 3: Search media for each image and get associated Post IDs
  const result = {};

  for (const imageUrl of imageUrls) {
    const postIds = await searchMedia(imageUrl, wordpressSiteUrl);
    result[imageUrl] = postIds;
  }

  // Output the result
  return result;
}

module.exports = { main };
