#!/usr/bin/env python3
"""Generate local latent embedding JSON for the CAE explainer.

Output schema matches the Svelte loader in Overview.svelte:
{
  "points": [
    {"x": float, "y": float, "label": int, "z": [float, ...]}
  ]
}
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
import umap


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate UMAP latent embedding JSON locally.")
    parser.add_argument(
        "--model-path",
        type=Path,
        default=Path("tiny-vgg/trained_cae_mnist.keras"),
        help="Path to trained Keras CAE model.",
    )
    parser.add_argument(
        "--output-path",
        type=Path,
        default=Path("public/assets/data/latent-embedding-umap-12000.json"),
        help="Target JSON path used by the web app.",
    )
    parser.add_argument(
        "--num-samples",
        type=int,
        default=12000,
        help="Number of MNIST samples to embed.",
    )
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--neighbors", type=int, default=30)
    parser.add_argument("--min-dist", type=float, default=0.08)
    return parser.parse_args()


def load_mnist() -> tuple[np.ndarray, np.ndarray]:
    (x_train, y_train), (x_test, y_test) = tf.keras.datasets.mnist.load_data()
    x = np.concatenate([x_train, x_test], axis=0).astype("float32") / 255.0
    y = np.concatenate([y_train, y_test], axis=0).astype("int32")
    x = np.expand_dims(x, axis=-1)
    return x, y


def pick_samples(x: np.ndarray, y: np.ndarray, num_samples: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    if num_samples <= 0:
        raise ValueError("num_samples must be > 0")

    num_samples = min(num_samples, x.shape[0])
    rng = np.random.default_rng(seed)
    indices = rng.choice(x.shape[0], size=num_samples, replace=False)
    return x[indices], y[indices]


def build_encoder(model: tf.keras.Model) -> tf.keras.Model:
    try:
        bottleneck = model.get_layer("bottleneck").output
    except ValueError as exc:
        raise ValueError("Could not find layer named 'bottleneck' in model.") from exc

    # Keras 3 may load a Sequential model without a bound symbolic input in some
    # environments until it is called at least once.
    if not getattr(model, "inputs", None):
        model.build((None, 28, 28, 1))
    if not getattr(model, "inputs", None):
        _ = model(tf.zeros((1, 28, 28, 1), dtype=tf.float32), training=False)

    if not getattr(model, "inputs", None):
        raise RuntimeError("Model inputs are not defined after build/call.")

    return tf.keras.Model(inputs=model.inputs, outputs=bottleneck, name="encoder")


def main() -> None:
    args = parse_args()
    tf.keras.utils.set_random_seed(args.seed)
    np.random.seed(args.seed)

    model_path = args.model_path.resolve()
    output_path = args.output_path.resolve()

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    print(f"Loading model: {model_path}")
    model = tf.keras.models.load_model(model_path, compile=False)
    encoder = build_encoder(model)

    print("Loading MNIST...")
    x, y = load_mnist()
    x_sel, y_sel = pick_samples(x, y, args.num_samples, args.seed)

    print(f"Encoding {x_sel.shape[0]} samples to latent vectors...")
    z = encoder.predict(x_sel, batch_size=512, verbose=0)

    print("Projecting latent vectors to 2D with UMAP...")
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=args.neighbors,
        min_dist=args.min_dist,
        metric="euclidean",
        random_state=args.seed,
    )
    proj = reducer.fit_transform(z)

    points = []
    for i in range(proj.shape[0]):
        points.append(
            {
                "x": float(proj[i, 0]),
                "y": float(proj[i, 1]),
                "label": int(y_sel[i]),
                "z": [float(v) for v in z[i].tolist()],
            }
        )

    payload = {
        "meta": {
            "model_path": str(model_path),
            "num_samples": int(proj.shape[0]),
            "latent_dim": int(z.shape[1]),
            "method": "umap",
            "neighbors": args.neighbors,
            "min_dist": args.min_dist,
            "seed": args.seed,
        },
        "points": points,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f)

    print(f"Wrote embedding JSON: {output_path}")


if __name__ == "__main__":
    main()
