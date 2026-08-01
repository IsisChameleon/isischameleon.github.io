# Setup a development environment to experiment with Langchain

Have you ever polluted your computer with repeated experiments using various libraries and poorly managed Python environments? Did you wonder how to ensure someone collaborating on your repo could easily spin off the same environment as yours?

In this tutorial, I show you how to combine the power of vscode extension Dev Containers to start up your own containerized development environment and maintain the list of libraries required for your Python project using the library Poetry.

## Pre-requisites

- 
docker must be installed on your computer (https://docs.docker.com/get-docker/)

- 
vscode with extension Dev Containers (https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

  

## Step 1. Creating the devcontainer configuration file

- clone your repo on your local machine, and open vscode on the related folder

```
PS D:\src> git clone https://github.com/IsisChameleon/tmprepo.git
Cloning into 'tmprepo'...

PS D:\src> cd tmprepo
PS D:\src\tmprepo> code .

```

- In vscode, run command (CTRL-SHIFT-P) Dev Containers "Add dev container configuration file"

- Select your dev container in the long list, here I typed poetry

- select latest python version and the OS

The dev container configuration is now created, along with its Dockerfile and vscode should ask if you want to reopen the folder to develop in a container. Click "Reopen in a container". If it doesn't this command is also available in Dev containers commands.

It's going to take some time if you don't have the container image on your computer as it downloads it.

Once the container is successfully created, you can check where you are in your container by launching a terminal command:

```
vscode ➜ /workspaces/tmprepo (main) $ cat /etc/os-release
PRETTY_NAME="Debian GNU/Linux 11 (bullseye)"
NAME="Debian GNU/Linux"
VERSION_ID="11"
VERSION="11 (bullseye)"
VERSION_CODENAME=bullseye
ID=debian
HOME_URL="https://www.debian.org/"
SUPPORT_URL="https://www.debian.org/support"
BUG_REPORT_URL="https://bugs.debian.org/"

```

In the host of your running container, that is in your local machine, you can request docker to display the list of running containers with docker ps command. docker inspect <container id> will give you all details about this container. You can view the same details in Docker Desktop (Containers).

```
PS D:\src> docker ps
CONTAINER ID   IMAGE                                                                          COMMAND
 CREATED          STATUS          PORTS     NAMES
9ed63f1aa024   vsc-tmprepo-5e48c0ce0f261fa4c7976274b9e602d8c0f6092999c9aa7b4df10c2982607199   "/bin/sh -c 'echo Co…"
 22 minutes ago   Up 22 minutes             wonderful_dirac

```

## Step 2. Initialize Python development environment with poetry

From here, I'll assume you are in vscode in your new dev container. You can check that by looking at the bottom left corner of vscode.

### 2.1 poetry init

Open a terminal and type poetry init and follow prompts (https://python-poetry.org/docs/basic-usage/#initialising-a-pre-existing-project). When it gets to this question Would you like to define your main dependencies interactively? (yes/no) [yes] answer y. Poetry will ask you for your "main" dependencies (dependencies for your final product) and your "dev" dependencies (libraries used only while developing the product).

The list of libraries you want to add depends on your project. Here's an example assuming you want to use Langchain with openai large language model (LLM), use Pinecone as vector database, ingest pdf documents as private data, and use Wikipedia and Google Search as additional tools for the LLM: pinecone-client langchain openai wikipedia google-api-python-client unstructured tabulate pdf2image. You can always add libraries later using poetry add. Poetry will prompt you something similar for each library:

```
Package to add or search for (leave blank to skip): langchain
Found 20 packages matching langchain
Showing the first 10 matches

Enter package # to add, or the complete package name if it is not listed []:
 [ 0] langchain
 [ 1] zh-langchain
 [ 2] pytest-langchain
 [ 3] langchain-prefect
 [ 4] langchain-util
 [ 5] langchain-utils
 [ 6] langchain-discord
 [ 7] langchain-visualizer
 [ 8] langchain-decorators
 [ 9] langchain-interpreter
 [ 10] 
 > 0
Enter the version constraint to require (or leave blank to use the latest version): 
Using version ^0.0.220 for langchain

```

Upon completion, poetry adds the pyproject.toml to your repo. It contains the list of requirements for your project.

```
[tool.poetry]
name = "tmprepo"
version = "0.1.0"
description = "dummy repo for langchain"
authors = ["some author"]
readme = "README.md"

[tool.poetry.dependencies]
python = "^3.10"
langchain = "^0.0.220"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

```

### 2.2 poetry install

Now run poetry install: this will install your requirements and also all the required sub-dependencies and produce the poetry.lock file. Generally, commit both pyproject.toml and poetry.lock in your repo, however as a library developer, you may choose not to commit the poetry.lock file (see https://python-poetry.org/docs/basic-usage/#committing-your-poetrylock-file-to-version-control). This command will also create your virtual Python environment.

```
vscode ➜ /workspaces/tmprepo (main) $ poetry install
Creating virtualenv tmprepo in /workspaces/tmprepo/.venv
Updating dependencies
Resolving dependencies... (16.5s)

Package operations: 29 installs, 0 updates, 0 removals

  • Installing packaging (23.1)
  • Installing certifi (2023.5.7)
  • Installing charset-normalizer (3.1.0)
...
  • Installing pyyaml (6.0)
  • Installing sqlalchemy (2.0.17)
  • Installing langchain (0.0.220)

Writing lock file

```

You can add more packages later using poetry add!

## Experiment with vscode Python notebooks

### Setup Python Kernel

- 
Install library ipykernel

```
 poetry add ipykernel

```

- 
Install the Jupyter extension in your dev container https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter&ssr=false#overview)

- 
Create a file with an extension .ipynb, write some Python code and try to run a cell. It will complain that you have not selected the kernel to execute Python code. Now install the recommended extensions in your dev container:

 

 If kernels still don't appear, make sure you have the Jupyter extension installed in your dev container, not in your host.

- 
Now you can select a kernel: choose the virtual environment that you have created with poetry in .venv/bin/python

 

### API Keys

When contacting the LLMs and other tools, you are likely to have a few API keys and credentials. Do not commit your API keys to your repo ever!!!! Instead, define your API keys in a file that you add to the .gitignore file.

- 
To load API keys from a .env file in Python, you can use the python-dotenv library. This library allows you to read the key-value pairs from the .env file and make them available as environment variables in your Python script.

```
 poetry add python-dotenv

```

- 
Create a .env file in the same directory as your Python script. In the .env file, define your API keys using the KEY=VALUE format.

```
 OPENAI_API_KEY='some_api_key'

```

- 
Exclude your .env file from version control!!!

 Create or modify .gitignore file

 

- 
In your Python script, import the dotenv module from python-dotenv and load the environment variables from the .env file, then access the API keys as environment variables in your code:

 

### Try Langchain!

Here are a few resources to get started...

- 
https://blog.langchain.dev/tutorial-chatgpt-over-your-data/

- 
https://newsletter.theaiedge.io/p/deep-dive-building-a-smart-chatbot

# References

As of 2/07/2023.

https://code.visualstudio.com/docs/devcontainers/create-dev-container

https://docs.langchain.com/docs/

https://www.pinecone.io/

https://programmablesearchengine.google.com/
