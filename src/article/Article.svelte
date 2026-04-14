<script>
</script>

<style>
	#description {
    margin-bottom: 60px;
    margin-left: auto;
    margin-right: auto;
  max-width: var(--content-max-width, 100ch);
  }

  #description h2 {
    color: #444;
    font-size: 44px;
    font-weight: 450;
    margin-bottom: 12px;
    margin-top: 60px;
  }

  #description h4 {
    color: #444;
    font-size: 35px;
    font-weight: 450;
    margin-bottom: 8px;
    margin-top: 44px;
  }

  #description h6 {
    color: #444;
    font-size: 26px;
    font-weight: 450;
    margin-bottom: 8px;
    margin-top: 32px;
  }

  #description p {
    margin: 16px 0;
  }

  #description ol {
    margin-left: 40px;
  }

  #description p,
  #description li {
    color: #555;
    font-size: 18px;
    line-height: 1.6;
    text-align: justify;
    text-justify: inter-word;
  }

  #description ul {
      list-style-type: disc;
      margin-top: -10px;
      margin-left: 40px;
      margin-bottom: 15px;
  }
    
</style>

<div id="description">
  <h2>What is a Convolutional Autoencoder?</h2>
  <p>
    A convolutional autoencoder (CAE) is a neural network that learns to compress
    an image into a small internal code and then reconstruct it back.
  </p>
  <p>
    Unlike a classifier, a CAE does not predict labels such as "3" or "7".
    Its goal is to rebuild the input image as accurately as possible.
  </p>
  <p>
    This makes CAEs useful for learning compact image representations,
    denoising, dimensionality reduction, and understanding what visual patterns
    a model keeps or discards.
  </p>

  <h2>Core Building Blocks</h2>
  <p>
    A few key terms will help you read the visualization:
  </p>
  <ol>
    <li><strong>Tensor:</strong> a multi-dimensional array of values (for example, image data).</li>
    <li><strong>Neuron / feature map:</strong> one channel of output values after a layer operation.</li>
    <li><strong>Layer:</strong> a group of neurons performing the same operation.</li>
    <li><strong>Weights and bias:</strong> learned parameters that shape each layer output.</li>
    <li><strong>Loss:</strong> a number that measures reconstruction error between input and output.</li>
  </ol>

  <h2>Encoder-Decoder Structure</h2>
  <p>
    A CAE has two major parts:
  </p>
  <ol>
    <li><strong>Encoder:</strong> gradually transforms the image into compact, high-level features.</li>
    <li><strong>Decoder:</strong> expands those compact features back into image space.</li>
  </ol>
  <p>
    The narrow middle part is the <strong>bottleneck</strong> (also called latent code).
    It forces the model to keep only the most important information.
  </p>

  <h2>How to Read the Model</h2>
  <h4>Input</h4>
  <p>
    The input is a 28x28 grayscale digit image. Brighter values represent larger
    pixel intensities.
  </p>

  <h4>Convolution Layers (Encoder Side)</h4>
  <p>
    Convolution layers slide small kernels over feature maps to detect local
    patterns like strokes, corners, and small shapes. Different kernels learn
    different visual detectors.
  </p>
  <p>
    Early convolution layers usually capture simple structure. Deeper layers
    combine those simple patterns into richer features.
  </p>

  <h4>Activation Layers</h4>
  <p>
    Nonlinear activations (for example ReLU-style behavior) help the network
    model complex patterns. Without nonlinearity, deep stacks of layers lose
    much of their expressive power.
  </p>

  <h4>Pooling Layers</h4>
  <p>
    Pooling reduces spatial size. This improves efficiency and pushes the model
    to keep stronger, more stable signals instead of every local detail.
  </p>

  <h4>Flatten and Dense Transition</h4>
  <p>
    In this architecture, encoder features are flattened into a vector and then
    transformed by dense layers. This is where the network shifts from
    spatial maps to compact feature vectors.
  </p>

  <h4>Bottleneck</h4>
  <p>
    The bottleneck is the compact code of the input. If this code is too small,
    reconstruction quality drops. If it is too large, compression becomes weak.
  </p>
  <p>
    The bottleneck is often the best place to inspect what the model has really
    learned about input structure.
  </p>

  <h4>Dense, Reshape, and Decoder Convolutions</h4>
  <p>
    Decoder layers reverse the compression path:
  </p>
  <ol>
    <li>Dense layers expand bottleneck features.</li>
    <li>Reshape converts vectors back into 2D feature-map layout.</li>
    <li>Upsampling and convolution rebuild spatial details.</li>
  </ol>
  <p>
    The decoder is not simply "copying" the input. It reconstructs from latent
    information, so any missing detail in the code can appear as blur,
    thickness shifts, or shape distortion.
  </p>

  <h4>Output</h4>
  <p>
    The output is the reconstructed image. Compare input and output to see what
    features are preserved, softened, or removed.
  </p>

  <h2>What Training Optimizes</h2>
  <p>
    During training, the CAE adjusts weights and biases to reduce reconstruction
    error between input and output (for example, mean squared error).
  </p>
  <p>
    In simple terms: the model improves by making output pixels look more like
    input pixels.
  </p>

  <h2>What You Can Learn in This Explainer</h2>
  <ol>
    <li>How local stroke patterns evolve into compact latent features.</li>
    <li>How flatten, dense, and reshape connect vector and spatial representations.</li>
    <li>How bottleneck capacity affects reconstruction quality.</li>
    <li>How decoder layers recover structure from compressed signals.</li>
    <li>How your own uploaded or drawn digits flow through the full network.</li>
  </ol>

  <h2>Interactive Features</h2>
  <ul>
    <li><strong>Click layer nodes</strong> to open operation-focused views.</li>
    <li><strong>Hover values and links</strong> to inspect activations and mappings.</li>
    <li><strong>Upload or draw your own digit</strong> to test custom inputs.</li>
    <li><strong>Inspect expanded flows</strong> to follow edge-by-edge transformations.</li>
  </ul>

  <h2>Practical Reading Guide</h2>
  <h6>If You Are New to Autoencoders</h6>
  <ol>
    <li>Start with one simple digit image.</li>
    <li>Track only one feature map per layer at first.</li>
    <li>Look at bottleneck values, then output differences.</li>
    <li>Repeat with a different digit and compare what changes.</li>
  </ol>

  <h6>What to Watch For</h6>
  <ul>
    <li>Where fine stroke detail is lost in encoder compression.</li>
    <li>Which decoder stages recover coarse shape first.</li>
    <li>How sign and magnitude in intermediate maps relate to final output quality.</li>
  </ul>

  <h2>Implementation</h2>
  <p>
    CAE Explainer runs entirely in the browser using TensorFlow.js for model
    inference, Svelte for UI structure, and D3.js for visualization.
  </p>
  <p>
    This implementation is adapted from the original CNN Explainer website:
    <a href="https://poloclub.github.io/cnn-explainer/" target="_blank" rel="noopener noreferrer">https://poloclub.github.io/cnn-explainer/</a>.
  </p>
  <p>
    The goal of this resource is educational: give learners a hands-on way to
    connect equations, layer operations, and visual behavior in one place.
  </p>
</div>
