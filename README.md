# CAE Explainer

An interactive, browser-based explainer for a Convolutional Autoencoder (CAE) on MNIST.

This project is adapted from CNN Explainer and focuses on:

- encoder-decoder flow instead of classification
- latent bottleneck behavior
- reconstruction quality and error maps
- latent-space exploration with UMAP projection and hover decoding

## What You Can Explore

- Input vs reconstructed output and absolute error
- Layer-by-layer CAE activations in an interactive model view
- Bottleneck-to-decoder behavior using detailed views
- 2D latent map colored by digit class
- Hover-to-reconstruct interpolation in latent space

## Tech Stack

- Svelte + Rollup for UI
- D3.js for visualization rendering
- TensorFlow.js for in-browser inference
- Python + TensorFlow/Keras + UMAP for offline latent embedding generation

## Project Structure

- [src/overview/Overview.svelte](src/overview/Overview.svelte): main interactive CAE and latent panels
- [src/article/Article.svelte](src/article/Article.svelte): educational article content
- [public/assets/data](public/assets/data): model artifacts and latent embedding JSON
- [tiny-vgg/train_cae_mnist.py](tiny-vgg/train_cae_mnist.py): trains and exports CAE artifacts
- [tiny-vgg/generate_latent_embedding.py](tiny-vgg/generate_latent_embedding.py): generates UMAP latent embedding JSON

## Run Locally

Install dependencies:

```bash
npm install
```

Start development mode (watch + local server):

```bash
npm run dev
npm run start:dev
```

Open http://localhost:3000

Build production bundle:

```bash
npm run build
```

## Data Files Required by the UI

The app expects these files under [public/assets/data](public/assets/data):

- autoencoder-model.json
- autoencoder-shard*.bin
- latent-embedding-umap-12000.json (or compatible fallback name)

## Train and Export the CAE

From the repository root:

```bash
uv venv --python 3.11 .venv-tf
uv pip install --python .venv-tf/bin/python tensorflow-cpu==2.16.1 tensorflowjs==4.20.0
.venv-tf/bin/python tiny-vgg/train_cae_mnist.py --epochs 12
```

This exports TensorFlow.js artifacts directly into [public/assets/data](public/assets/data).

## Generate Latent UMAP Embedding

Install Python dependencies (same environment is fine):

```bash
uv pip install --python .venv-tf/bin/python umap-learn
```

Generate the embedding JSON used by the Latent Space Explorer:

```bash
.venv-tf/bin/python tiny-vgg/generate_latent_embedding.py \
  --model-path tiny-vgg/trained_cae_mnist.keras \
  --output-path public/assets/data/latent-embedding-umap-12000.json \
  --num-samples 12000
```

## Notes

- If the latent panel appears stale, hard refresh the browser.
- The UI loader supports multiple latent JSON filenames, but the default is latent-embedding-umap-12000.json.

## Credits

Original CNN Explainer was created by the Georgia Tech Visualization Lab and collaborators:

- Jay Wang
- Robert Turko
- Omar Shaikh
- Haekyu Park
- Nilaksh Das
- Fred Hohman
- Minsuk Kahng
- Polo Chau

This repository extends that foundation for a CAE-focused educational workflow.

## Citation

If you use the original CNN Explainer in academic work, please cite:

```bibtex
@article{wangCNNExplainerLearning2020,
  title = {{{CNN Explainer}}: {{Learning Convolutional Neural Networks}} with {{Interactive Visualization}}},
  shorttitle = {{{CNN Explainer}}},
  author = {Wang, Zijie J. and Turko, Robert and Shaikh, Omar and Park, Haekyu and Das, Nilaksh and Hohman, Fred and Kahng, Minsuk and Chau, Duen Horng},
  journal={IEEE Transactions on Visualization and Computer Graphics (TVCG)},
  year={2020},
  publisher={IEEE}
}
```

## License

MIT License. See [LICENSE](LICENSE).
