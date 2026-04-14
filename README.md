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

## Host on GitHub Pages

This project is static, so GitHub Pages is a good default hosting option.

1) Confirm repository settings

- Repository name is expected to be AEExplainer.
- Default branch is main.
- Push all latest changes to main.

2) Deploy

Run:

```bash
npm install
npm run deploy:gh
```

What this does:

- Builds with PUBLIC_URL=/AEExplainer
- Copies static assets into dist
- Adds .nojekyll
- Publishes dist to the gh-pages branch

3) Enable Pages in GitHub

- Go to Settings -> Pages.
- Source: Deploy from a branch.
- Branch: gh-pages, folder: /(root).
- Save.

Your site URL will be:

- https://<your-username>.github.io/AEExplainer/

4) Verify production paths

- Open the site and confirm model/data files load under /AEExplainer/assets/...
- Check the browser network tab for:
  - bundle.js
  - bundle.css
  - assets/data/autoencoder-model.json
  - assets/data/latent-embedding-umap-12000.json

5) Redeploy after changes

```bash
npm run deploy:gh
```

## Performance and Responsiveness Checklist

For best speed and broad compatibility on GitHub Pages:

- Keep static assets in public/assets and avoid runtime API dependencies.
- Use production build for deploys (already done by deploy:gh).
- Keep model and embedding files reasonably sized.
- Prefer compressed numeric precision in large JSON files when possible.
- Test responsive layout at desktop, tablet, and mobile widths.
- Validate first-load performance on a cold browser cache.
- Use Chrome Lighthouse and watch these metrics:
  - LCP under 2.5s on typical broadband
  - CLS near 0
  - TBT as low as possible

Optional optimization ideas:

- Downsample latent points for low-end devices and offer a high-detail toggle.
- Lazy-load heavy panels only when they enter viewport.
- Move very large data files behind progressive loading.

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
