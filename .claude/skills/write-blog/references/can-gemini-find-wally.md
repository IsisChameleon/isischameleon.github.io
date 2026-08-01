# Can Gemini find Wally?

On the 6th of December, Google DeepMind released its long-awaited Gemini AI model. Gemini is built with multimodality in mind, this means that it is capable of understanding text, images, videos, audio, and code.

Just before Christmas, I joined a LabLab.ai hackaton featuring Gemini and LlamaIndex, a simple, flexible data framework for connecting custom data sources to large language models. Compared to Langchain, they specialize in all things RAG (i.e. where you need to retrieve something from your data before querying the LLM for an answer, check my previous blog on the topic). LlamaIndex has introduced multi-modal RAG back in November, following the release of the GPT-4V API.

So in this blog, my goal is to share what I learned by getting Gemini to try and find Wally. Where's Wally? is a British series of children's puzzle books created by English illustrator Martin Handford. The books consist of a series of detailed double-page spread illustrations depicting dozens or more people doing a variety of amusing things at a given location. Readers are challenged to find a character named Wally hidden in the group [Wikipedia]

We'll be going through a python notebook that

- 
Query gemini-pro-vision model using text and image: given a target image (Wally) can Gemini find it in a source image?

- 
Implement a multi-modal RAG

- 
Select a series of images as our targets (characters or objects)

- 
Provide a description of those images (in this instance, we use a LLM to do so, but we could also provide private information, such as custom names or metadata)

- 
Add both the images and their descriptions in a vector store

- 
When the user requests to "Can you find Wally in this image?" given a source image, we will go through 2 steps:

- 
Retrieve: Use the user query to retrieve an image of the target.

- 
Query: Send the user request with the target image and the source image to Gemini asking it to tell us whether he found the target!

# Using Gemini in Vertex AI

You can play with Gemini in Vertex AI on Google Cloud Platform with zero code involved.

To try it, head to the GCP model garden. As prerequisite, you need to login with your Google account and set up a project. Select View Details on Gemini Pro Vision and then Open Vertex AI Studio.

On the right, you can see a few parameters that control the answer from the model. The parameters temperature, top-k, and top-p are commonly associated with text generation in LLMs. These parameters play a crucial role in controlling the randomness and diversity of the generated text. As you may know, LLMs select the next token based on a probability distribution. A high temperature "flattens" the distribution, making less likely tokens more probable. This creates a more uniform distribution, increasing the randomness in the model's outputs. Conversely a lower temperature, makes the probability distribution more "peaky". Top-k says to "sample(choose) the next token amongst the top k most likely ones". With top-p sampling, the model selects the smallest set of tokens whose cumulative probability (the sum of their probability) exceeds threshold p, and then sample from those ones. Change in temperature will influence both sampling methods. For more detailed information, with a bit of code, checkout this blog post from HuggingFace.

So, Gemini, where's Wally? I tried a few prompt with these 2 images.

I got a pretty decent answer.

So I decided to go ahead with my notebook.

# Notebook

Find it here!

## 1. Simple prompt to Gemini

If you follow along with the notebook, go ahead and run section 1 and 2. You will need a GOOGLE_API_KEY for a project that has access to gemini-pro-vision. You can get one here. Please remember, when you use API keys in your Google Cloud Platform (GCP) applications, take care to keep them secure (do not print them in code that could be committed etc...) and set up budgets limit in case they inadvertently escape and are maliciously used.

1.3 Load target and source images

This is where you can select your targets, and give them a name (that can also be used as keyword when retrieving targets later on). Each target is input as a Tuple with a keyword string (or "name") and an image URL. Same for the sources. The sources are the images where we want Gemini to find the targets.

```
targets_name_url = [('wally', 'https://steemitimages.com/DQmYEFMCdofVgxRf1VnDYSG9ejxop4wtjCU3B383dEC9tKW/WALLY.png'), 
                         ('wally', 'https://metro.co.uk/wp-content/uploads/2016/03/pm_25817756.jpg?quality=90&strip=all&zoom=1&resize=540%2C1056'),
('wally girl', 'https://www.vhv.rs/dpng/d/225-2256117_wheres-wally-the-fantastic-journey-wheres-waldo-wizard.png'),
('doggy',  'https://dl5zpyw5k3jeb.cloudfront.net/photos/pets/70138307/3/?bust=1703362531&width=720'),
('demon',  'https://i.pinimg.com/originals/5c/11/14/5c111438124efdfe67e3c76bbe61025d.jpg')]

sources_name_url = [('beach', 'https://wallpapercave.com/wp/wp7156925.jpg'), 
 ('snow easy', 'https://wallpapercave.com/wp/wp7156958.png'), ('vikings', 'https://wallpapercave.com/wp/wp7156934.jpg')]

```

This function is going to download those images, save them locally, compress them if they are larger than an arbitrary 3 MB (if they are very large they will fill out Gemini context and it throws an exception) then add each of those image into a list of Llama_index ImageDocument object, a data document containing an image.

```
def save_image_url_and_create_image_document_with_metadata(image_type: Literal['source', 'target'], name_urls, image_folder):
  # save images
  if not os.path.exists(image_folder):
      os.makedirs(image_folder)

  image_documents = []
  for idx, tupl in enumerate(name_urls):
      image_url=tupl[1]
      name = tupl[0]
      print(idx, tupl)
      response = requests.get(image_url)
      img = Image.open(BytesIO(response.content))
      image_path=f"{image_folder}/{name}-{idx}.png"
      print(image_path)
      img.save(image_path)

      image_path = compress_image(image_path, 3 * 1024 * 1024)

      metadata = {"name": name, "image_type": image_type}

      image_documents.append(ImageDocument(image_path=image_path, metadata=metadata))

  return image_documents

target_image_documents = save_image_url_and_create_image_document_with_metadata('target', targets_name_url, TARGET_FOLDER)
source_image_documents = save_image_url_and_create_image_document_with_metadata('source', sources_name_url, SOURCE_FOLDER)

```

Then we will configure the Gemini call, giving our API key, setting up the Google Generative AI endpoint details and also the parameters of the model (temperature, top-k, top-p) and finally set up the LlamaIndex wrapper GeminiMultiModal to request completion from Gemini.

```
import google.generativeai as genai
from llama_index.multi_modal_llms.gemini import GeminiMultiModal
from google.generativeai.types import GenerationConfig, GenerationConfigType
from llama_index.multi_modal_llms import GeminiMultiModal

genai.configure(
    api_key=GOOGLE_API_KEY,
    client_options={"api_endpoint": "generativelanguage.googleapis.com"},
)

gemini_generation_config = GenerationConfig(1, temperature=0, top_p=1, top_k=32)

gemini_llm = GeminiMultiModal(
    api_key=GOOGLE_API_KEY, 
    model_name="models/gemini-pro-vision",
    generation_congfig=gemini_generation_config
)

```

Finally we select one target image and one source image from each list of ImageDocuments, and send off the completion request.

```
from llama_index.multi_modal_llms import GeminiMultiModal
from llama_index.program import MultiModalLLMCompletionProgram
from llama_index.output_parsers import PydanticOutputParser
from llama_index.schema import ImageDocument

prompt_template_str = """\
Below you will be given 2 images, a "target" and a "source". The target may be contained in the source. Locate the target in the source.

Output format:
If no target found in the image: reply "target not found in the source" 
If target found: give the approximate position of the target in the source, using the coordinate system starting at (0,0) in the top left corner and (100%, 100%) in the bottom right corner. 
Describe with precision other entities at the top, left, right and bottom of the target. 

Target: 
{target}

Source:
{source}
"""

llm_response = gemini_llm.complete(prompt=prompt_template_str, image_documents=image_documents)

```

I was mildly annoyed by the fact that, when using the complete method of the GeminiMultiModal, you can only pass a text prompt, then a series of images, while when I was working in Vertex AI I could mix some text, then an image, then another text... I looked at the Google API and confirmed that indeed you could send a list of text and images in any particular order. So in the notebook, you will find a CustomGeminiMultiModal, child class of GeminiMultiModal with a new version of the complete method, where the goal is to insert an image where {target} and {source} are in the above prompt, with a bit of text between them all. That is an option, and it show different results, but I also could have changed my prompt to say something like:

```
prompt_template_str = """\
Below you will be given 2 images, a "target" and a "source". 

Instructions:
If no target found in the image: reply "target not found in the source" 
If target found: give the approximate position of the target in the source, using the coordinate system starting at (0,0) in the top left corner and (100%, 100%) in the bottom right corner. 
Describe with precision other entities at the top, left, right and bottom of the target. 

Pay attention, the first image you get is the target and the second image is the source.
"""

```

So play around with the prompt, sources and images and see what you get. This just replicates what you can do in Vertex AI.

### Results

I observed that Gemini can locate Wally, but is hallucinating a lot when trying to describe Wally surrounding. When asked to locate something that is not in the image, for example a lady walking a dog, none of the prompts I tried let Gemini say that the target is not in the image.

## 2 Multimodal RAG

Imagine you have a list of targets (characters or objects), not as famous as Wally and not likely to be in the training knowledge of the LLM (private information). You want to store the image of those targets, so that, when the user requests to locate them in an image, you can retrieve their image and pass it on as context to the user request.

### 2.2 Retrieval with CLIP embeddings

We chose ChromaDb as our vector store because its supports multi-modal embedding functions, which can be used to embed data from multiple modalities into a single embedding space.

Chroma has the OpenCLIP embedding function built in, which supports both text and images.

CLIP (Contrastive Language-Image Pre-Training) is a neural network model developed by OpenAI that learns to understand images and text in a similar way. It's trained on a vast number of (image, text) pairs. The model produces embeddings (vector representations) for both images and text that are closely aligned in the same vector space. This means that similar concepts, whether expressed in text or in an image, have similar vector representations. In our case, CLIP embeddings are used to understand and retrieve relevant images based on textual descriptions. This adds a visual dimension to the retrieval process in RAG.

First we will set up an ephemeral Chroma client (in-memory vector store) with our CLIP embedding function and the Chroma image loader, and then create our collection of vector named "multimodal_collection_wally".

```
from chromadb.utils.embedding_functions import OpenCLIPEmbeddingFunction
import chromadb
from chromadb.utils.data_loaders import ImageLoader

# set defalut text and image embedding functions
embedding_function = OpenCLIPEmbeddingFunction()

image_loader = ImageLoader()

chroma_client = chromadb.EphemeralClient()
chroma_collection = chroma_client.create_collection(
    "multimodal_collection_wally",
    embedding_function=embedding_function,
    data_loader=image_loader,
)

```

The following command loads all target images as LlamaIndex documents and then create an index based on our Chroma collection. Finally, we turn that index into a retriever to be able to do a multimodal semantic search: we input a text query, we retrieve images.

```
# set up ChromaVectorStore and load in data
from llama_index.vector_stores import ChromaVectorStore
from llama_index.indices import VectorStoreIndex
from llama_index import StorageContext, ServiceContext
from llama_index import SimpleDirectoryReader

# load target images
documents_rag = SimpleDirectoryReader(TARGET_FOLDER).load_data()

vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

index = VectorStoreIndex.from_documents(
    documents=documents_rag,
    storage_context=storage_context,
    show_progress=True
)

retriever = index.as_retriever(similarity_top_k=3)
retrieval_results = retriever.retrieve("What are the similarities between Wanda and Wally?")

```

The retrieval process is the first step of the RAG, i.e. retrieve relevant information to the user query in our knowledge base. The next step is performed by what LlamaIndex calls a query engine, i.e. relevant information is passed on along with user query to the LLM so that it can generate an answer. In our case that query engine must support a multi-modal model since we're going to pass on images alongside text. This VectorStoreIndex query engine, does not (yet?) support a multimodal LLM so this will be for another post....

Instead I'll conclude my demo by manually by querying the retriever for a target, and then prompting Gemini.

With my source:

Some hallucinations here and there, definitely no blue pants. Play around with parameters. Maybe I should get a competition going with GPT4V to find Wally?

Wow, your reached the end 😍! Feel free to leave comments and questions, I'll do my best to answer. Also, let me know if there is any subject that you would like to hear about.
