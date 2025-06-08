# Bio-XYZ Hackathon - Eliza with bioagent plugin

Chronos — a eliza OS agentic system designed for clinicians and biomedical researchers, combining a semantic network with an autonomous hypothesis engine. It extracts overlooked insights from historical spine surgery records and traditional medical texts, structuring them into RDF triple stores such as [Oxigraph](https://github.com/oxigraph/oxigraph) that bridges ancient wisdom with contemporary science. 

## 🎯**How It Works**
* **Digitization & Document Extraction**
    * Uses **Landing AI** to digitize undigitized historical spine surgery texts.
    * Extracts relevant clinical content through **agentic document processing**.
* **Decentralized Storage**
    * Stores digitized documents on **Pinata**, ensuring decentralized, redundant preservation and accessibility.
* **Knowledge Graph Construction**
    * Structures extracted information into a **semantic network** using **ORKG**.
    * Designed to integrate with **Oxigraph RDf-triples**.
* **Semantic Integration of Knowledge**
    * Formalizes historical observations into **machine-readable hypotheses**.
    * Links traditional spine surgery insights with **modern scientific knowledge**.
    * Enables **traceability** and **cross-domain hypothesis generation**.
* **Autonomous Hypothesis Generation**
    * An intelligent engine mines the knowledge graph to generate **novel, testable hypotheses**.
    * Each hypothesis is grounded in **contextual evidence**—historical data, modern studies, and semantic bridge nodes.
    * Powered by **OpenAI models** for natural language understanding and reasoning.
* **Structuring for LLMs**
    * Uses **LlamaIndex** to preprocess and structure unstructured documents for compatibility with LLMs.

![Chronos-architectutre-diagram](https://github.com/user-attachments/assets/c125757c-8be5-44bb-a575-8d5892759944)

## 🛠 Getting Started

Follow these steps to install and launch the BioAgent Plugin:

### 1. Install System Dependencies

Ensure the following dependencies are installed on your system:

```bash
# For Ubuntu/Debian
sudo apt-get install ghostscript graphicsmagick
```

### 2. Clone the Repository

```bash
git clone https://github.com/Sidharth1743/SpineDAO-Final.git
cd SpineDAO-Final
```

### 3. Install Project Dependencies

```bash
pnpm install
pnpm install llamindex #If llamaindex not installed automatically
```

### 4. Start Required Docker Containers

Start PostgreSQL with pgvector extension for vector storage:

```bash
docker run --name plugin-bioagent-postgres \
  --network pgnetwork \
  -e POSTGRES_PASSWORD=123 \
  -p 5432:5432 \
  -d pgvector/pgvector:pg17
```
```bash
docker run --name pgadmin \
  --network pgnetwork \
  -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL=admin@admin.com \
  -e PGADMIN_DEFAULT_PASSWORD=admin \
  -d dpage/pgadmin4
```

Start Oxigraph RDF triple store or use OriginTrail's DKG:

```bash
docker run --rm -v $PWD/oxigraph:/data -p 7878:7878 ghcr.io/oxigraph/oxigraph serve --location /data --bind 0.0.0.0:7878
```

### 5. Launch the Development Server

```bash
pnpm run dev
```

This command starts the development server at `http://localhost:3000`. Allow around 90 seconds for initial setup, after which the BioAgent Plugin will begin generating and evaluating hypotheses.

## 🔧 Configure Environment Variables

Copy and rename the example environment file:

```bash
mv .env.example .env
```

### Essential Environment Variables

Update your `.env` file with the following variables:

```env
PROD_URL=https://your-production-domain.com # for production
DEV_URL=https://handsome-bubblegum-shepherd.ngrok-free.app # for local development (from ngrok)
POSTGRES_URL=postgresql://user:password@localhost:5432/dbname
OPENAI_API_KEY=your_openai_api_key
GCP_JSON_CREDENTIALS={"type": "service_account", "project_id": "your_project_id", ...}  # Your full GCP service account JSON
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id  # Google Drive folder ID for scientific papers
DISCORD_APPLICATION_ID=your_discord_app_id
DISCORD_API_TOKEN=your_discord_bot_token
DISCORD_VOICE_CHANNEL_ID=your_voice_channel_id  # Optional
DISCORD_CHANNEL_ID=your_text_channel_id
BIONTOLOGY_KEY=your_biontology_api_key  # Obtain at https://bioportal.bioontology.org/accounts/new
PINATA_JWT=your_pinataJWT token
GATEWAY_URL=Your_cloud_gateway_url
PINATA_API_KEY=pinata_public_key
PINATA_API_SECRET=pinata_private_key
VISION_AGENT_API_KEY=your_landing_ai_api_key
```

## 📋 Obtaining Google Cloud Service Account JSON & Setting Permissions

### Creating a Service Account

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create your desired project.
3. Navigate to **APIs & Services** > **Credentials**.
4. Click **+ CREATE CREDENTIALS**, then select **Service Account**.
5. Provide a descriptive name for the service account and click **Create**.
6. Assign necessary roles (e.g., Editor) and click **Continue**.
7. Open the newly created service account, go to the **Keys** tab.
8. Click **Add Key** > **Create new key**, choose **JSON**, and click **Create**. The JSON file will automatically download.
9. Copy the JSON as it is in the `.env` file in the `GCP_JSON_CREDENTIALS` variable. It should look like this:

```env
GCP_JSON_CREDENTIALS={"type": "service_account", "project_id": "your_project_id", ...} # Your full GCP service account JSON, in a single line
```

### Granting Access to Google Drive Folder

1. Open your [Google Drive](https://drive.google.com/).
2. Navigate to the folder associated with the `GOOGLE_DRIVE_FOLDER_ID`.
3. Right-click the folder and select **Share**.
4. Enter the service account email (available in your downloaded JSON file) into the sharing field.
5. Set permissions ("Editor" or "Viewer") accordingly and click **Send**.

Your Google Cloud service account now has access to the specified folder. 📁🔑✅

## 🔄 Setting Up Google Drive Webhook (for dropping documents into the folder)

### 1. Configure Webhook URL

1. For local development use [`ngrok`](https://ngrok.com/blog-post/free-static-domains-ngrok-users):

```bash
ngrok http --domain=handsome-bubblegum-shepherd.ngrok-free.app 3000
```

Add the ngrok URL to your `.env`:

```env
DEV_URL=https://handsome-bubblegum-shepherd.ngrok-free.app
```

2. For production:
   Add your production domain to `.env`:

```env
PROD_URL=https://your-production-domain.com
```

The webhook will automatically use `DEV_URL` in development and `PROD_URL` in production. 🔄📄
