# Running a Local Vector Store

> **Purpose of this setup:** This is a proof-of-concept environment to demonstrate that Smart Workflow can perform RAG using OpenSearch as a vector store. It is not intended to be a production-ready deployment. For a real project, OpenSearch should be properly secured, scaled, and managed by your infrastructure team.

This appendix explains how to start a local OpenSearch instance for use as a vector store during development and tutorial exercises. The setup is Docker-based and requires no cloud account or external service.

> **For development and demo use only.** Security is disabled on this instance — it runs over plain HTTP with no authentication. Do not use it in a production environment or expose it on a public network.

---

## Prerequisites

- **Rancher Desktop** installed and running — free and open source, recommended for most development environments. Download from [rancherdesktop.io](https://rancherdesktop.io). During setup, select **dockerd (moby)** as the container runtime so that `docker` and `docker compose` commands are available on the PATH.
- Alternatively, **Docker Desktop** works equally well if your company has purchased a license (Docker Desktop requires a paid subscription for commercial use).
- The `external-resources/vector-store/opensearch/` folder from this repository.

---

## What is included

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Defines the OpenSearch container (`opensearchproject/opensearch:3.5.0`) |
| `start.ps1` | Interactive startup script for Windows (PowerShell) |
| `start.sh` | Interactive startup script for Linux / macOS (Bash) |
| `.env` | Stores your password and port between runs — created on first start, git-ignored |

---

## Starting the vector store

### Windows (PowerShell)

Open a PowerShell terminal, navigate to the `opensearch/` folder, then run:

```
.\start.ps1
```

If the script is blocked by a permission error, ask your IT team to adjust the execution policy, or run the following to allow it for the current session only:

```
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```

### Linux / macOS (Bash)

Open a terminal, navigate to the `opensearch/` folder, then run:

```
chmod +x start.sh
./start.sh
```

---

## What happens when you run the script

The script walks through four steps automatically:

**1. Disclaimer**

You are prompted to type `ok` to confirm you understand this is a dev-only setup.

**2. Admin password (first run only)**

OpenSearch 2.12+ requires an admin password at container startup. The password:
- Must be at least 12 characters with uppercase, lowercase, a digit, and a special character.
- Is saved to `.env` so you are not asked again on subsequent starts.
- Is **not** used for connections from Ivy — leave the Ivy password variables blank.

**3. Port check**

The default port is `19600`. If that port is already in use, the script automatically finds the next free port and saves it to `.env`.

**4. Container startup and health check**

The script runs `docker compose up -d` and waits up to 60 seconds for OpenSearch to respond. When it is ready, the connection details are printed.

---

## Connection details

When the script finishes, it prints the values you need:

```
===========================================================
  OpenSearch Vector Store
-----------------------------------------------------------
  URL      : http://localhost:19600
-----------------------------------------------------------
  Set these Ivy variables:
    AI.RAG.OpenSearch.Url               = http://localhost:19600
    AI.RAG.OpenSearch.ApiKey             = (leave blank)
    AI.RAG.OpenSearch.UserName           = (leave blank)
    AI.RAG.OpenSearch.Password           = (leave blank)
===========================================================
```

---

## Configuring Ivy

Open `variables.yaml` (or set through the Ivy engine configuration) and add:

```yaml
Variables:
  AI:
    RAG:
      OpenSearch:
        Url: "http://localhost:19600"
        ApiKey: ""
        UserName: ""
        Password: ""
```

Leave `ApiKey`, `UserName`, and `Password` blank — security is disabled on this local instance so no credentials are needed for connections.

---

## Verifying the vector store

Once the instance is running you can check its state directly in a browser or with any HTTP client.

### Check if OpenSearch is up

```
http://localhost:19600/
```

Returns a JSON response with the cluster name and version. If you see a response, the instance is running.

### Check if your index exists

```
http://localhost:19600/your-vector-index-name
```

Replace `your-vector-index-name` with the collection name you used during ingestion (e.g. `company-benefits`). Returns the index settings and mappings if the index exists, or a 404 if it has not been created yet.

### Inspect all indexed records

```
http://localhost:19600/your-vector-index-name/_search?pretty=true
```

Returns all documents stored in the index in a formatted JSON response. Useful for confirming that chunks were embedded and stored correctly after running ingestion.

---

## Stopping, restarting, and resetting

From the `opensearch/` folder:

| Action | Command |
| --- | --- |
| Stop the container (keeps data) | `docker compose stop` |
| Start again after a stop | `docker compose start` |
| Stream live logs | `docker compose logs -f` |
| Full reset — deletes all indexed data | `docker compose down -v` |

> After `docker compose down -v`, all indexed chunks are gone. You will need to re-run ingestion before the agent can search again.

---

## Troubleshooting

**Script times out waiting for OpenSearch to become ready**

Check the container logs for startup errors:

```
docker logs smart-workflow-opensearch
```

Common causes: Docker Desktop does not have enough memory allocated (OpenSearch recommends at least 2 GB), or the container exited immediately due to a configuration error.

**Port conflict on every start**

If port 19600 is always occupied by another process, edit `.env` directly and set `OPENSEARCH_PORT` to a free port number. The script reads this value on the next start.

**`docker compose` not found**

The script supports both the Docker Compose V2 plugin (`docker compose`) and the standalone binary (`docker-compose`). Make sure Docker Desktop is up to date, or install the standalone binary separately.

---

## Demo documents

The `external-resources/demo-documents/` folder contains sample files ready for ingestion:

| File | Description |
| --- | --- |
| `company-benefits.md` | Fictional company HR benefits guide — 14 topics including leave, health insurance, and remote work. Ideal for testing HR Q&A queries. |

Use these with the RAG Demo wizard in Feature 14 to ingest documents and test semantic search without needing your own data.

---

## See also

- [RAG as a Tool]
- [What is RAG (Appendix A)]
