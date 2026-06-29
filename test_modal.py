import modal

app = modal.App(image=modal.Image.debian_slim().pip_install("openai"))


@app.function(secrets=[modal.Secret.from_name("openai-secret")])
def complete_text(prompt):
    from openai import OpenAI

    client = OpenAI()

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model="gpt-4o",  # Fixed: changed from gpt-4.1 to gpt-4o
    )
    return chat_completion.choices[0].message.content


@app.local_entrypoint()
def main(prompt: str = "The easiest way to deploy a serverless GPU function in Python is "):
    print(complete_text.remote(prompt))
