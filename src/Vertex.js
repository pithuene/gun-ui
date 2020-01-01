import './Vertex.css';

import React from 'react';

function Vertex({ node }) {
	const containerStyle = {
		display: 'flex',
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center',
	};

	const vertexStyle = {
		fontSize: '5px',
		backgroundColor: '#FFF',
		border: '1px solid #CCC',
	};

	const renderProp = (prop) => {
		if (prop.value === null) return;
		return (
			<div key={prop.name}>
				<code>
					{prop.name}: {prop.value + ''}
				</code>
			</div>
		);
	};

	const renderProps = (props) => {
		let renderedProps = [];
		for (let prop in props) {
			renderedProps.push(renderProp({ name: prop, value: props[prop] }));
		}
		return renderedProps;
	};

	return (
		<div style={containerStyle}>
			<div className="vertex" style={vertexStyle}>
				<h3>{node.id}</h3>
				{renderProps(node.props)}
			</div>
		</div>
	);
}

export default Vertex;
