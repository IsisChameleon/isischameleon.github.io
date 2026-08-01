# A journey from LLM Chain to Agents using Langchain (part 2)

Code available to run on Colab: https://gist.github.com/IsisChameleon/dae06d3d99e26e083345a32466e5e417

including

- 
Conversational agent using Langchain

- 
React agent

- 
Langchain agent with a llama_index retriever

# Simple Agents

Chains are statically defined by their links: the first link of the chain takes an input, transforms it and passes it on to the next link and so on until the final output. The input is for example a natural language query or some text, that got passed on to an LLM or some other function for transformation. We have seen that in the simple examples in my previous blog.

What if your query needs to be handled in different ways depending on the input and the related context (memory)? And you want the LLM to "decide" what action to take next? For example, answering a user query may require looking up a database, calling an API, or performing a semantic search in your vectorized knowledge base. It's hard to code in a standard procedural way because that decision will depend on understanding the meaning of the user query.

In these types of chains, there is an “agent” which has access to a suite of tools. Depending on the user input, the agent can then decide which, if any, of these tools to call. This is achieved by using a specific prompt to ask the LLM to select amongst a suite of tools with their description to achieve the desired outcome, and then use that tool with the recommended input.

### Agents in Langchain

At the moment, there are two main types of agents in Langchain (https://blog.langchain.dev/plan-and-execute-agents/):

- 
“Action Agents”: these agents decide an action to take and take that action one step at a time

- 
“Plan-and-Execute Agents”: these agents first decide a plan of actions to take, and then execute those actions one at a time.(https://python.langchain.com/docs/use_cases/more/agents/autonomous_agents/plan_and_execute). The idea is largely inspired from by BabyAGI and then the "Plan-and-Solve" paper.

 The planning (i.e. subtasks required to complete the main task) is executed by an LLM chain, and then each subtask is given to an Action Agent.

### Action Agent

There are 3 components involved in creating a working agent in Langchain

1) a set of tools: for example, a retriever is a tool (performing a semantic search on your knowledge base for example, or sending a SQL query to a database), calling an API, invoking Google search, posting a tweet, ....

2) the agent: it takes a user input/query, and returns an action (what tool to use) as well as the action input

3) the agent executor: it is the "clever loop" that binds it all. "The agent executor is responsible for calling the agent, getting back an action and action input, calling the tool that the action references with the corresponding input, getting the output of the tool, and then passing all that information back into the Agent to get the next action it should take". (https://docs.langchain.com/docs/components/agents/agent-executor)

Let's take an example of a simple conversational agent that has a tool to read a pdf, and another one to search online with DuckDuckGo.

#### (1) Setup retriever tool to query PDF

We load the pdf, chunk it, create an in-memory index in FAISS, set it up as a retriever with specific search parameters for the semantic search, and then we make this a tool by giving it a name and a description. The description is important because that's what allows the LLM to decide to use that tool or not.

```
from llama_index.indices import document_summary
from langchain.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import PyPDFLoader
from langchain.embeddings import OpenAIEmbeddings
from langchain.agents.agent_toolkits import create_retriever_tool

loader = PyPDFLoader('agent-reflexion.pdf')
splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=128)
docs = loader.load()
chunked_docs = splitter.split_documents(docs)

search_kwargs = {
    "distance_metric": "cos",
    "fetch_k": 10,
    "k": 10,
    "maximal_marginal_relevance": True
}

vectorstore = FAISS.from_documents(chunked_docs, embedding = OpenAIEmbeddings())
retriever = vectorstore.as_retriever()
retriever.search_kwargs = search_kwargs;

search_paper_tool = create_retriever_tool(
    retriever,
    "search_paper_agent_reflexion",
    "Retrieve information about a paper entitled Reflexion: Language Agents with Verbal Reinforcement Learning"
)

```

...

Then we add another tool:

```
from langchain.tools import DuckDuckGoSearchRun
from langchain.agents import Tool

duckduckgo_search_tool = Tool(
    name="DuckDuckGoSearch",
    func=DuckDuckGoSearchRun().run,
    description="Search the web with DuckDuckGo"
)

tools = [duckduckgo_search_tool, search_paper_tool]

```

#### Setting up the agent with memory

```

from langchain.agents.openai_functions_agent.agent_token_buffer_memory import AgentTokenBufferMemory
from langchain.chat_models import ChatOpenAI

llm = ChatOpenAI(model='gpt-4', temperature = 0)

# This is needed for both the memory and the prompt
memory_key = "history"

memory = AgentTokenBufferMemory(memory_key=memory_key, llm=llm)

```

#### Setting up the agent and its prompt

```
#-----------------
# PROMPT TEMPLATE
#-----------------

from langchain.agents.openai_functions_agent.base import OpenAIFunctionsAgent
from langchain.schema.messages import SystemMessage
from langchain.prompts import MessagesPlaceholder

prompt = """
You are an expert scientist studying language models and can explain complex topics by breaking it down into simpler elements. Your role is to help humans understand scientific papers about language model, in a clear way. Do your best to explain the question asked.
Feel free to use any tools available to look up relevant information, only if necessary.
"""

system_message = SystemMessage(
        content=(
            prompt
        )
)

prompt = OpenAIFunctionsAgent.create_prompt(
        system_message=system_message,
        extra_prompt_messages=[MessagesPlaceholder(variable_name=memory_key)]
    )

#-----------------
# AGENT
#-----------------

agent = OpenAIFunctionsAgent(llm=llm, tools=tools, prompt=prompt)

```

Now we set up the agent executor that will prompt the agent for the next action, execute the agent action and send the result back to the agent for another iteration until the agent concludes that there is enough information to answer the query.

```
#-----------------
# AGENT EXECUTOR
#-----------------

from langchain.agents import AgentExecutor

agent_executor = AgentExecutor(agent=agent, tools=tools, memory=memory, verbose=True,
                                   return_intermediate_steps=True)

```

And finally, your agent is ready to be queried!

```
result = agent_executor({"input": "Can you please summarise the paper Reflexion: Language Agents with Verbal Reinforcement Learning "})

```

For this first question, it will invoke the semantic search tool. What about this one?

This time it rightly selected the web search...

You can keep conversing with your agent, but beware in this simple example the conversation history keeps piling up so at some stage you'll run out of tokens. To fix that you have to implement some form of context pruning or summarizing :-)

Check out the full code here (you can run it in Colab), with a few more examples:

- 
React agent

- 
Using Llama_index retriever with a Langchain agent.
